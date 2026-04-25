import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AggregationsService } from '../aggregations/aggregations.service';

const PII_FIELDS = [
  'userId',
  'email',
  'accountNumber',
  'supabaseId',
  'id',
  'accessToken',
];

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface MonthContext {
  summary: {
    netWorth: number;
    totalDebt: number;
    income: number;
    expense: number;
  };
  topCategories: { name?: string; amount: number }[];
}

@Injectable()
export class AdvisorService {
  private ollamaUrl: string;
  private ollamaModel: string;

  constructor(
    private aggregations: AggregationsService,
    private config: ConfigService,
  ) {
    this.ollamaUrl = this.config.get<string>('OLLAMA_URL') || 'http://localhost:11434';
    this.ollamaModel = this.config.get<string>('OLLAMA_MODEL') || 'llama3';
  }

  stripPII(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.stripPII(item));
    }
    if (data && typeof data === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (PII_FIELDS.includes(key)) continue;
        result[key] = this.stripPII(value);
      }
      return result;
    }
    return data;
  }

  async getAdvice(userId: string) {
    const reply = await this.chat(userId, []);
    return {
      insights: reply.content,
      generatedAt: new Date().toISOString(),
    };
  }

  async chat(
    userId: string,
    clientMessages: ChatMessage[],
  ): Promise<ChatMessage> {
    const context = await this.buildContext(userId);
    const systemPrompt = this.buildSystemPrompt(context);

    // Chat models won't produce a reply from a system message alone — they
    // need a user turn to respond to. When the client opens a fresh
    // conversation, prime it with an opening prompt.
    const primedMessages: ChatMessage[] = clientMessages.length
      ? clientMessages
      : [
          {
            role: 'user',
            content:
              "Hey, how am I doing this month? Lead with the single most important thing I should know — a specific win worth celebrating or a specific concern to address — grounded in the numbers.",
          },
        ];

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...primedMessages,
    ];

    const response = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.ollamaModel,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      role: 'assistant',
      content: data.message?.content ?? '',
    };
  }

  private monthBounds(offset: number): { start: string; end: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    const toIso = (d: Date) => d.toISOString().split('T')[0];
    return { start: toIso(start), end: toIso(end) };
  }

  private async buildContext(
    userId: string,
  ): Promise<{ current: MonthContext; previous: MonthContext }> {
    const cur = this.monthBounds(0);
    const prev = this.monthBounds(-1);

    const [curSummary, curCats, prevSummary, prevCats] = await Promise.all([
      this.aggregations.getSummary(userId, cur.start, cur.end),
      this.aggregations.getSpendingByCategory(userId, cur.start, cur.end),
      this.aggregations.getSummary(userId, prev.start, prev.end),
      this.aggregations.getSpendingByCategory(userId, prev.start, prev.end),
    ]);

    return this.stripPII({
      current: {
        summary: curSummary,
        topCategories: curCats.slice(0, 3),
      },
      previous: {
        summary: prevSummary,
        topCategories: prevCats.slice(0, 3),
      },
    });
  }

  private buildSystemPrompt(ctx: {
    current: MonthContext;
    previous: MonthContext;
  }): string {
    const fmt = (n: number) =>
      Number(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const savingsRate = (s: MonthContext['summary']) =>
      s.income > 0
        ? ((1 - s.expense / s.income) * 100).toFixed(1)
        : '0.0';

    const renderCats = (cats: MonthContext['topCategories']) =>
      cats.length
        ? cats
            .map((c) => `  - ${c.name ?? 'Uncategorized'}: $${fmt(c.amount)}`)
            .join('\n')
        : '  (none yet)';

    const cur = ctx.current.summary;
    const prev = ctx.previous.summary;
    const curSaved = cur.income - cur.expense;
    const prevSaved = prev.income - prev.expense;
    const expenseDelta = Number((cur.expense - prev.expense).toFixed(2));
    const savedMore = -expenseDelta;

    const trendLine =
      prev.expense === 0
        ? 'No prior-month data to compare yet.'
        : savedMore > 0
          ? `Spending is down $${fmt(savedMore)} vs last month — nice trend.`
          : savedMore < 0
            ? `Spending is up $${fmt(Math.abs(savedMore))} vs last month.`
            : 'Spending is flat vs last month.';

    return `You're a friendly financial buddy — talk like a supportive friend, not a corporate advisor. Lead with the single most important thing the user should know: either a specific win worth celebrating or a specific concern worth addressing. Reference exact dollar amounts from the numbers below, compare this month to last month when the numbers tell a story, and keep replies conversational and short (no rigid numbered lists unless the user asks for one). Use first person ("I see...", "you're...").

Rules about the numbers:
- Use only the figures listed below. Do not invent equations, do not derive new amounts by doing arithmetic on values from different sections, and do not append parenthetical math like "($X - $Y)" to your sentences. If you cite a dollar figure, it must appear verbatim below.
- "Standing balance" numbers are point-in-time totals (what the user has and owes right now). They are NOT this month's savings or activity. Never subtract them or use them as monthly flow.
- "This month" numbers are flow — money that moved during the current calendar month. Use "Saved this month" when talking about how much was set aside.

Standing balance (point-in-time, not flow):
- Net worth: $${fmt(cur.netWorth)}
- Total debt: $${fmt(Math.abs(cur.totalDebt))}

This month so far (flow):
- Income: $${fmt(cur.income)}
- Expenses: $${fmt(cur.expense)}
- Saved this month: $${fmt(curSaved)}
- Savings rate: ${savingsRate(cur)}%
- Top spending categories:
${renderCats(ctx.current.topCategories)}

Last month (flow):
- Income: $${fmt(prev.income)}
- Expenses: $${fmt(prev.expense)}
- Saved last month: $${fmt(prevSaved)}
- Savings rate: ${savingsRate(prev)}%
- Top spending categories:
${renderCats(ctx.previous.topCategories)}

Trend: ${trendLine}

Ground every observation in these specific numbers. If the user asks a follow-up, answer it directly using the same numbers — don't repeat the opening pep talk.`;
  }
}

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
    const savingsRate = (s: MonthContext['summary']) =>
      s.income > 0
        ? ((1 - s.expense / s.income) * 100).toFixed(1)
        : '0.0';

    const renderCats = (cats: MonthContext['topCategories']) =>
      cats.length
        ? cats
            .map((c) => `  - ${c.name ?? 'Uncategorized'}: $${c.amount}`)
            .join('\n')
        : '  (none yet)';

    const cur = ctx.current.summary;
    const prev = ctx.previous.summary;
    const expenseDelta = Number((cur.expense - prev.expense).toFixed(2));
    const savedMore = -expenseDelta;

    const trendLine =
      prev.expense === 0
        ? 'No prior-month data to compare yet.'
        : savedMore >= 0
          ? `Spending is down $${savedMore.toFixed(2)} vs last month — nice trend.`
          : `Spending is up $${Math.abs(savedMore).toFixed(2)} vs last month.`;

    return `You're a friendly financial buddy — talk like a supportive friend, not a corporate advisor. Lead with the single most important thing the user should know: either a specific win worth celebrating or a specific concern worth addressing. Reference exact dollar amounts from the numbers below, compare this month to last month when the numbers tell a story, and keep replies conversational and short (no rigid numbered lists unless the user asks for one). Use first person ("I see...", "you're...").

Here's the user's current financial snapshot.

This month so far:
- Net worth: $${cur.netWorth}
- Total debt: $${Math.abs(cur.totalDebt)}
- Income: $${cur.income}
- Expenses: $${cur.expense}
- Savings rate: ${savingsRate(cur)}%
- Top spending categories:
${renderCats(ctx.current.topCategories)}

Last month:
- Income: $${prev.income}
- Expenses: $${prev.expense}
- Savings rate: ${savingsRate(prev)}%
- Top spending categories:
${renderCats(ctx.previous.topCategories)}

Trend: ${trendLine}

Ground every observation in these specific numbers. If the user asks a follow-up, answer it directly using the same numbers — don't repeat the opening pep talk.`;
  }
}

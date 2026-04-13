import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AggregationsService } from '../aggregations/aggregations.service';
import Anthropic from '@anthropic-ai/sdk';

const PII_FIELDS = [
  'userId',
  'email',
  'name',
  'accountNumber',
  'supabaseId',
  'id',
  'accessToken',
];

@Injectable()
export class AdvisorService {
  private anthropic: Anthropic;

  constructor(
    private aggregations: AggregationsService,
    private config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
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
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    const [summary, categories] = await Promise.all([
      this.aggregations.getSummary(userId, startDate, endDate),
      this.aggregations.getSpendingByCategory(userId, startDate, endDate),
    ]);

    const anonymized = this.stripPII({ summary, categories });

    const prompt = `You are a personal finance advisor. Based on the following anonymized financial data for this month, provide 3-5 concise, actionable insights about spending patterns, saving opportunities, and financial health.

Financial Summary:
- Net Worth: $${anonymized.summary.netWorth}
- Total Debt: $${Math.abs(anonymized.summary.totalDebt)}
- Monthly Income: $${anonymized.summary.income}
- Monthly Expenses: $${anonymized.summary.expense}
- Savings Rate: ${anonymized.summary.income > 0 ? ((1 - anonymized.summary.expense / anonymized.summary.income) * 100).toFixed(1) : 0}%

Spending by Category:
${anonymized.categories.map((c: any) => `- ${c.name}: $${c.amount}`).join('\n')}

Provide specific, numbered insights. Be encouraging but honest.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const insights =
      response.content[0].type === 'text' ? response.content[0].text : '';

    return { insights, generatedAt: new Date().toISOString() };
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdvisorService } from './advisor.service';
import { AggregationsService } from '../aggregations/aggregations.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  AccountType: {
    CHECKING: 'CHECKING',
    SAVINGS: 'SAVINGS',
    CREDIT: 'CREDIT',
    LOAN: 'LOAN',
    STOCK: 'STOCK',
    CASH: 'CASH',
    INVESTMENT: 'INVESTMENT',
    RETIREMENT: 'RETIREMENT',
  },
  TransactionType: { INCOME: 'INCOME', EXPENSE: 'EXPENSE', TRANSFER: 'TRANSFER' },
}));

// Mock global fetch for Ollama calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AdvisorService', () => {
  let service: AdvisorService;

  const userId = 'user-123';

  const mockAggregations = {
    getSummary: jest.fn().mockResolvedValue({
      netWorth: 15000,
      totalDebt: -500,
      income: 5000,
      expense: 3200,
    }),
    getSpendingByCategory: jest.fn().mockResolvedValue([
      { categoryId: 'cat-1', name: 'Groceries', color: '#4CAF50', amount: 800 },
      { categoryId: 'cat-2', name: 'Dining Out', color: '#FF9800', amount: 450 },
      { categoryId: 'cat-3', name: 'Entertainment', color: '#E91E63', amount: 200 },
    ]),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const vals: Record<string, string> = {
        OLLAMA_URL: 'http://localhost:11434',
        OLLAMA_MODEL: 'llama3',
      };
      return vals[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvisorService,
        { provide: AggregationsService, useValue: mockAggregations },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AdvisorService>(AdvisorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('stripPII', () => {
    it('should remove user identifiers from data', () => {
      const data = {
        userId: 'user-123',
        email: 'test@example.com',
        accountNumber: '1234-5678',
        netWorth: 15000,
      };

      const stripped = service.stripPII(data);

      expect(stripped).not.toHaveProperty('userId');
      expect(stripped).not.toHaveProperty('email');
      expect(stripped).not.toHaveProperty('accountNumber');
      expect(stripped).toHaveProperty('netWorth', 15000);
    });

    it('preserves `name` on category labels (regression: was wiping them)', () => {
      // Category names like "Groceries" are not PII. They were being stripped
      // by the overzealous PII filter, causing the LLM to see `undefined`.
      const data = {
        categories: [
          { categoryId: 'c1', name: 'Groceries', amount: 800 },
          { categoryId: 'c2', name: 'Dining Out', amount: 450 },
        ],
      };

      const stripped = service.stripPII(data);

      expect(stripped.categories[0].name).toBe('Groceries');
      expect(stripped.categories[1].name).toBe('Dining Out');
    });

    it('should handle nested objects', () => {
      const data = {
        summary: { userId: 'x', netWorth: 10000 },
        accounts: [{ id: 'a1', accountNumber: '9999', balance: 5000 }],
      };

      const stripped = service.stripPII(data);
      expect(JSON.stringify(stripped)).not.toContain('userId');
      expect(JSON.stringify(stripped)).not.toContain('accountNumber');
    });
  });

  const mockOllamaOnce = (content: string) =>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content } }),
    });

  const getFetchBody = (callIndex = 0) =>
    JSON.parse(mockFetch.mock.calls[callIndex][1].body);

  describe('getAdvice', () => {
    it('should call Ollama and return insights', async () => {
      mockOllamaOnce('Nice — you trimmed dining costs by $50 vs last month.');

      const result = await service.getAdvice(userId);

      expect(mockAggregations.getSummary).toHaveBeenCalled();
      expect(mockAggregations.getSpendingByCategory).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toHaveProperty('insights');
      expect(result.insights).toContain('dining');
      expect(result).toHaveProperty('generatedAt');
    });

    it('system prompt renders actual category names (not "undefined")', async () => {
      mockOllamaOnce('opening analysis');
      await service.getAdvice(userId);

      const body = getFetchBody();
      const systemMessage = body.messages.find((m: any) => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('Groceries');
      expect(systemMessage.content).toContain('Dining Out');
      expect(systemMessage.content).not.toContain('undefined');
    });

    it('system prompt includes prior-month comparison context', async () => {
      mockOllamaOnce('opening analysis');
      await service.getAdvice(userId);

      const body = getFetchBody();
      const systemMessage = body.messages.find((m: any) => m.role === 'system');
      // Aggregations are called for BOTH current and previous months
      expect(mockAggregations.getSummary).toHaveBeenCalledTimes(2);
      expect(mockAggregations.getSpendingByCategory).toHaveBeenCalledTimes(2);
      expect(systemMessage.content).toMatch(/last month/i);
    });

    it('should throw on Ollama failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable',
      });

      await expect(service.getAdvice(userId)).rejects.toThrow('Ollama request failed');
    });
  });

  describe('chat', () => {
    it('threads client messages after the system prompt', async () => {
      mockOllamaOnce('Totally — dining out was $450 this month.');

      const reply = await service.chat(userId, [
        { role: 'user', content: 'What about dining?' },
      ]);

      const body = getFetchBody();
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1]).toEqual({
        role: 'user',
        content: 'What about dining?',
      });
      expect(reply).toEqual({
        role: 'assistant',
        content: 'Totally — dining out was $450 this month.',
      });
    });

    it('preserves full multi-turn history in order', async () => {
      mockOllamaOnce('Good follow-up answer');

      await service.chat(userId, [
        { role: 'user', content: 'How am I doing?' },
        { role: 'assistant', content: 'Pretty well overall.' },
        { role: 'user', content: 'What should I cut?' },
      ]);

      const body = getFetchBody();
      expect(body.messages).toHaveLength(4);
      expect(body.messages.map((m: any) => m.role)).toEqual([
        'system',
        'user',
        'assistant',
        'user',
      ]);
      expect(body.messages[3].content).toBe('What should I cut?');
    });

    it('rebuilds context on every call (stateless)', async () => {
      mockOllamaOnce('first');
      mockOllamaOnce('second');

      await service.chat(userId, []);
      await service.chat(userId, []);

      // Each chat call triggers a fresh pair of aggregation fetches for both months.
      expect(mockAggregations.getSummary).toHaveBeenCalledTimes(4);
      expect(mockAggregations.getSpendingByCategory).toHaveBeenCalledTimes(4);
    });

    it('returns empty string when Ollama returns no content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: null }),
      });

      const reply = await service.chat(userId, [
        { role: 'user', content: 'hi' },
      ]);
      expect(reply).toEqual({ role: 'assistant', content: '' });
    });
  });
});

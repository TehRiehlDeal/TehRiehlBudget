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
        name: 'John Doe',
        accountNumber: '1234-5678',
        netWorth: 15000,
        categories: [{ name: 'Groceries', amount: 800 }],
      };

      const stripped = service.stripPII(data);

      expect(stripped).not.toHaveProperty('userId');
      expect(stripped).not.toHaveProperty('email');
      expect(stripped).not.toHaveProperty('name');
      expect(stripped).not.toHaveProperty('accountNumber');
      expect(stripped).toHaveProperty('netWorth', 15000);
      expect(stripped).toHaveProperty('categories');
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

  describe('getAdvice', () => {
    it('should call Ollama and return insights', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: '1. Great savings rate!\n2. Reduce dining costs.',
          },
        }),
      });

      const result = await service.getAdvice(userId);

      expect(mockAggregations.getSummary).toHaveBeenCalled();
      expect(mockAggregations.getSpendingByCategory).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toHaveProperty('insights');
      expect(result.insights).toContain('savings rate');
    });

    it('should throw on Ollama failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable',
      });

      await expect(service.getAdvice(userId)).rejects.toThrow('Ollama request failed');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdvisorService } from './advisor.service';
import { AggregationsService } from '../aggregations/aggregations.service';

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

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
    getOrThrow: jest.fn().mockReturnValue('test-api-key'),
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
    it('should fetch aggregation data and return AI insights', async () => {
      const mockClient = service['anthropic'];
      (mockClient.messages.create as jest.Mock).mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '1. Your dining out spending is 14% of income — consider meal prepping.\n2. Strong savings rate of 36% — keep it up.\n3. Consider setting a monthly entertainment budget.',
          },
        ],
      });

      const result = await service.getAdvice(userId);

      expect(mockAggregations.getSummary).toHaveBeenCalled();
      expect(mockAggregations.getSpendingByCategory).toHaveBeenCalled();
      expect(mockClient.messages.create).toHaveBeenCalled();
      expect(result).toHaveProperty('insights');
      expect(typeof result.insights).toBe('string');
    });
  });
});

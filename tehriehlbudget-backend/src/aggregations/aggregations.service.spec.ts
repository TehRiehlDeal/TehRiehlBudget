import { Test, TestingModule } from '@nestjs/testing';
import { AggregationsService } from './aggregations.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

describe('AggregationsService', () => {
  let service: AggregationsService;

  const userId = 'user-123';

  const mockPrisma = {
    account: {
      aggregate: jest.fn(),
    },
    transaction: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AggregationsService>(AggregationsService);
  });

  describe('getNetWorth', () => {
    it('should sum all account balances', async () => {
      mockPrisma.account.aggregate.mockResolvedValue({
        _sum: { balance: 15000.5 },
      });

      const result = await service.getNetWorth(userId);
      expect(result).toBe(15000.5);
      expect(mockPrisma.account.aggregate).toHaveBeenCalledWith({
        where: { userId },
        _sum: { balance: true },
      });
    });

    it('should return 0 when no accounts', async () => {
      mockPrisma.account.aggregate.mockResolvedValue({
        _sum: { balance: null },
      });

      const result = await service.getNetWorth(userId);
      expect(result).toBe(0);
    });
  });

  describe('getTotalDebt', () => {
    it('should sum CREDIT and LOAN balances', async () => {
      mockPrisma.account.aggregate.mockResolvedValue({
        _sum: { balance: -1500 },
      });

      const result = await service.getTotalDebt(userId);
      expect(result).toBe(-1500);
    });
  });

  describe('getIncomeVsExpense', () => {
    it('should return income and expense totals', async () => {
      mockPrisma.transaction.groupBy.mockResolvedValue([
        { type: 'INCOME', _sum: { amount: 5000 } },
        { type: 'EXPENSE', _sum: { amount: 3200 } },
      ]);

      const result = await service.getIncomeVsExpense(
        userId,
        '2026-04-01',
        '2026-04-30',
      );

      expect(result.income).toBe(5000);
      expect(result.expense).toBe(3200);
    });
  });

  describe('getSpendingByCategory', () => {
    it('should return grouped spending with category names', async () => {
      mockPrisma.transaction.groupBy.mockResolvedValue([
        { categoryId: 'cat-1', _sum: { amount: 200 } },
        { categoryId: 'cat-2', _sum: { amount: 150 } },
      ]);
      mockPrisma.transaction.findMany.mockResolvedValue([
        { category: { id: 'cat-1', name: 'Groceries', color: '#4CAF50' } },
        { category: { id: 'cat-2', name: 'Dining', color: '#FF9800' } },
      ]);

      const result = await service.getSpendingByCategory(
        userId,
        '2026-04-01',
        '2026-04-30',
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('amount');
    });
  });
});

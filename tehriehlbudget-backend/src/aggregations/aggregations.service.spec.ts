import { Test, TestingModule } from '@nestjs/testing';
import { AggregationsService } from './aggregations.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  AccountType: {
    CHECKING: 'CHECKING',
    SAVINGS: 'SAVINGS',
    CREDIT: 'CREDIT',
    LOAN: 'LOAN',
    STOCK: 'STOCK',
  },
  TransactionType: { INCOME: 'INCOME', EXPENSE: 'EXPENSE', TRANSFER: 'TRANSFER' },
}));

describe('AggregationsService', () => {
  let service: AggregationsService;

  const userId = 'user-123';

  const mockPrisma: any = {
    account: {
      aggregate: jest.fn(),
      findFirst: jest.fn(),
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
      // First call = assets aggregate, second call = liabilities aggregate
      mockPrisma.account.aggregate
        .mockResolvedValueOnce({ _sum: { balance: 15000.5 } })
        .mockResolvedValueOnce({ _sum: { balance: 2000 } });

      const result = await service.getNetWorth(userId);
      expect(result).toBe(13000.5);
      expect(mockPrisma.account.aggregate).toHaveBeenCalledWith({
        where: { userId, type: { in: ['CHECKING', 'SAVINGS', 'STOCK'] } },
        _sum: { balance: true },
      });
      expect(mockPrisma.account.aggregate).toHaveBeenCalledWith({
        where: { userId, type: { in: ['CREDIT', 'LOAN'] } },
        _sum: { balance: true },
      });
    });

    it('should return 0 when no accounts', async () => {
      mockPrisma.account.aggregate
        .mockResolvedValueOnce({ _sum: { balance: null } })
        .mockResolvedValueOnce({ _sum: { balance: null } });

      const result = await service.getNetWorth(userId);
      expect(result).toBe(0);
    });

    it('should subtract liabilities from assets', async () => {
      // $5000 checking + $10000 savings = $15000 assets
      // $3000 credit card + $500 loan = $3500 liabilities
      // net worth = 15000 - 3500 = 11500
      mockPrisma.account.aggregate
        .mockResolvedValueOnce({ _sum: { balance: 15000 } })
        .mockResolvedValueOnce({ _sum: { balance: 3500 } });

      const result = await service.getNetWorth(userId);
      expect(result).toBe(11500);
    });
  });

  describe('getTotalDebt', () => {
    it('should sum CREDIT and LOAN balances', async () => {
      mockPrisma.account.aggregate.mockResolvedValue({
        _sum: { balance: 1500 },
      });

      const result = await service.getTotalDebt(userId);
      expect(result).toBe(1500);
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

  describe('getAccountBalanceHistory', () => {
    it('throws NotFound if the account is not owned by the user', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      await expect(
        service.getAccountBalanceHistory(userId, 'acc-missing'),
      ).rejects.toThrow();
    });

    it('reconstructs history for an asset account walking transactions backward', async () => {
      // Current balance: $1000 on CHECKING.
      // Transactions (newest first):
      //   - $50 expense
      //   - $200 income
      // So before the income, balance was $800. Before the expense, balance was $1050.
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        type: 'CHECKING',
        balance: 1000,
      });
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 't2',
          accountId: 'acc-1',
          destinationAccountId: null,
          type: 'EXPENSE',
          amount: 50,
          date: new Date('2026-04-10'),
        },
        {
          id: 't1',
          accountId: 'acc-1',
          destinationAccountId: null,
          type: 'INCOME',
          amount: 200,
          date: new Date('2026-04-05'),
        },
      ]);

      const result = await service.getAccountBalanceHistory(userId, 'acc-1');

      // Returned oldest-first
      expect(result).toHaveLength(3);
      expect(result[0].balance).toBe(850); // before the $200 income
      expect(result[1].balance).toBe(1050); // before the $50 expense
      expect(result[2].balance).toBe(1000); // current
    });

    it('treats credit-card expenses as debt increase when walking backwards', async () => {
      // Current balance (debt): $500 on a CREDIT card.
      // Transactions: a $100 EXPENSE (charge). Before that the debt was $400.
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-cc',
        type: 'CREDIT',
        balance: 500,
      });
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 't1',
          accountId: 'acc-cc',
          destinationAccountId: null,
          type: 'EXPENSE',
          amount: 100,
          date: new Date('2026-04-05'),
        },
      ]);

      const result = await service.getAccountBalanceHistory(userId, 'acc-cc');
      expect(result[0].balance).toBe(400); // before the charge
      expect(result[result.length - 1].balance).toBe(500);
    });
  });
});

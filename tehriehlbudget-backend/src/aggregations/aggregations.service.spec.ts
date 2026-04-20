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
    CASH: 'CASH',
    INVESTMENT: 'INVESTMENT',
    RETIREMENT: 'RETIREMENT',
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
    accountValuation: {
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
        where: {
          userId,
          type: {
            in: ['CHECKING', 'SAVINGS', 'STOCK', 'CASH', 'INVESTMENT', 'RETIREMENT'],
          },
        },
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

    it('includes noon-UTC transactions on the end date of the range', async () => {
      // Regression: transactions are stored at noon UTC. If parseDateRange
      // ended at midnight UTC, a transaction dated "2026-04-30" (stored as
      // 2026-04-30T12:00:00Z) would fall AFTER the end boundary and be
      // silently dropped from the dashboard aggregates.
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      await service.getIncomeVsExpense(userId, '2026-04-01', '2026-04-30');

      const call = mockPrisma.transaction.groupBy.mock.calls[0][0];
      const end: Date = call.where.date.lte;
      const start: Date = call.where.date.gte;
      const noonUtcOnEndDate = new Date(Date.UTC(2026, 3, 30, 12, 0, 0));
      const noonUtcOnStartDate = new Date(Date.UTC(2026, 3, 1, 12, 0, 0));
      expect(end.getTime()).toBeGreaterThanOrEqual(noonUtcOnEndDate.getTime());
      expect(start.getTime()).toBeLessThanOrEqual(noonUtcOnStartDate.getTime());
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

  describe('getCashFlow', () => {
    const start = '2026-04-01';
    const end = '2026-04-30';

    it('returns zeros when no transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 0, outflows: 0, net: 0 });
    });

    it('counts INCOME to CHECKING as inflow', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'INCOME',
          amount: 5000,
          account: { type: 'CHECKING' },
          destinationAccount: null,
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 5000, outflows: 0, net: 5000 });
    });

    it('counts EXPENSE on CHECKING as outflow', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'EXPENSE',
          amount: 200,
          account: { type: 'CHECKING' },
          destinationAccount: null,
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 0, outflows: 200, net: -200 });
    });

    it('does NOT count EXPENSE on CREDIT (swipe does not touch cash)', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'EXPENSE',
          amount: 150,
          account: { type: 'CREDIT' },
          destinationAccount: null,
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 0, outflows: 0, net: 0 });
    });

    it('counts CC payment (TRANSFER checking → credit) as outflow', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'TRANSFER',
          amount: 300,
          account: { type: 'CHECKING' },
          destinationAccount: { type: 'CREDIT' },
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 0, outflows: 300, net: -300 });
    });

    it('counts loan payment (TRANSFER checking → loan) as outflow', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'TRANSFER',
          amount: 450,
          account: { type: 'CHECKING' },
          destinationAccount: { type: 'LOAN' },
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 0, outflows: 450, net: -450 });
    });

    it('cancels internal transfers between liquid accounts (checking → savings)', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'TRANSFER',
          amount: 1000,
          account: { type: 'CHECKING' },
          destinationAccount: { type: 'SAVINGS' },
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 1000, outflows: 1000, net: 0 });
    });

    it('counts investing (TRANSFER checking → stock) as outflow', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'TRANSFER',
          amount: 500,
          account: { type: 'CHECKING' },
          destinationAccount: { type: 'STOCK' },
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 0, outflows: 500, net: -500 });
    });

    it('does NOT count INCOME on CREDIT (refund to a card)', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'INCOME',
          amount: 80,
          account: { type: 'CREDIT' },
          destinationAccount: null,
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 0, outflows: 0, net: 0 });
    });

    it('counts TRANSFER from stock → checking as inflow (sale, cash in)', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'TRANSFER',
          amount: 2000,
          account: { type: 'STOCK' },
          destinationAccount: { type: 'CHECKING' },
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 2000, outflows: 0, net: 2000 });
    });

    it('aggregates a realistic month', async () => {
      // $5000 paycheck + $200 expense on checking + $300 CC payment
      //   + $1000 internal checking→savings + $150 swipe on credit (ignored)
      // inflows = 5000 + 1000 (internal counted on both sides)
      // outflows = 200 + 300 + 1000
      // net = 6000 - 1500 = 4500
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          type: 'INCOME',
          amount: 5000,
          account: { type: 'CHECKING' },
          destinationAccount: null,
        },
        {
          type: 'EXPENSE',
          amount: 200,
          account: { type: 'CHECKING' },
          destinationAccount: null,
        },
        {
          type: 'TRANSFER',
          amount: 300,
          account: { type: 'CHECKING' },
          destinationAccount: { type: 'CREDIT' },
        },
        {
          type: 'TRANSFER',
          amount: 1000,
          account: { type: 'CHECKING' },
          destinationAccount: { type: 'SAVINGS' },
        },
        {
          type: 'EXPENSE',
          amount: 150,
          account: { type: 'CREDIT' },
          destinationAccount: null,
        },
      ]);
      const result = await service.getCashFlow(userId, start, end);
      expect(result).toEqual({ inflows: 6000, outflows: 1500, net: 4500 });
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
      //   - $50 expense (Grocery run)
      //   - $200 income (Paycheck)
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
          description: 'Grocery run',
          createdAt: new Date('2026-04-10T15:00:00Z'),
        },
        {
          id: 't1',
          accountId: 'acc-1',
          destinationAccountId: null,
          type: 'INCOME',
          amount: 200,
          date: new Date('2026-04-05'),
          description: 'Paycheck',
          createdAt: new Date('2026-04-05T08:00:00Z'),
        },
      ]);

      const result = await service.getAccountBalanceHistory(userId, 'acc-1');

      // Returned oldest-first
      expect(result).toHaveLength(3);
      expect(result[0].balance).toBe(850); // before the $200 income
      expect(result[1].balance).toBe(1050); // before the $50 expense
      expect(result[2].balance).toBe(1000); // current

      // Transaction points carry description + signed change; today point does not.
      expect(result[0].description).toBe('Paycheck');
      expect(result[0].change).toBe(200);
      expect(result[1].description).toBe('Grocery run');
      expect(result[1].change).toBe(-50);
      expect(result[2].description).toBeUndefined();
      expect(result[2].change).toBeUndefined();
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
          description: 'Charge',
          createdAt: new Date('2026-04-05T12:00:00Z'),
        },
      ]);

      const result = await service.getAccountBalanceHistory(userId, 'acc-cc');
      expect(result[0].balance).toBe(400); // before the charge
      expect(result[result.length - 1].balance).toBe(500);
    });

    it('uses valuations (not transactions) for STOCK accounts', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-stock',
        type: 'STOCK',
        balance: 10000,
      });
      mockPrisma.accountValuation.findMany.mockResolvedValue([
        { date: new Date('2026-04-01'), value: 9500 },
        { date: new Date('2026-04-08'), value: 9800 },
        { date: new Date('2026-04-15'), value: 10000 },
      ]);

      const result = await service.getAccountBalanceHistory(userId, 'acc-stock');

      expect(mockPrisma.accountValuation.findMany).toHaveBeenCalled();
      expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([
        { date: '2026-04-01', balance: 9500 },
        { date: '2026-04-08', balance: 9800 },
        { date: '2026-04-15', balance: 10000 },
      ]);
    });

    it('uses valuations for RETIREMENT accounts', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-401k',
        type: 'RETIREMENT',
        balance: 50000,
      });
      mockPrisma.accountValuation.findMany.mockResolvedValue([
        { date: new Date('2026-04-01'), value: 50000 },
      ]);

      const result = await service.getAccountBalanceHistory(userId, 'acc-401k');
      expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].balance).toBe(50000);
    });

    it('orders same-day transactions by createdAt so walk-back matches insertion order', async () => {
      // Regression: same-day transactions were walked in arbitrary order,
      // producing chart points that dipped below the pre-income balance
      // even when income was entered before the expenses.
      //
      // Prior balance was $950. Same day (4/17):
      //   t1 INCOME $5000 (created first)
      //   t2 EXPENSE $100 (created after)
      // Current balance = 950 + 5000 - 100 = 5850.
      //
      // Walking back newest-createdAt first, the sequence (oldest-first) must be:
      //   before income: $950
      //   after income / before expense: $5950
      //   current: $5850
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        type: 'CHECKING',
        balance: 5850,
      });
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 't2',
          accountId: 'acc-1',
          destinationAccountId: null,
          type: 'EXPENSE',
          amount: 100,
          date: new Date('2026-04-17T12:00:00Z'),
          createdAt: new Date('2026-04-17T10:05:00Z'),
        },
        {
          id: 't1',
          accountId: 'acc-1',
          destinationAccountId: null,
          type: 'INCOME',
          amount: 5000,
          date: new Date('2026-04-17T12:00:00Z'),
          createdAt: new Date('2026-04-17T10:00:00Z'),
        },
      ]);

      const result = await service.getAccountBalanceHistory(userId, 'acc-1');

      const call = mockPrisma.transaction.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual([{ date: 'desc' }, { createdAt: 'desc' }]);

      expect(result.map((p) => p.balance)).toEqual([950, 5950, 5850]);
    });

    it('uses valuations for INVESTMENT accounts', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-inv',
        type: 'INVESTMENT',
        balance: 7500,
      });
      mockPrisma.accountValuation.findMany.mockResolvedValue([]);

      const result = await service.getAccountBalanceHistory(userId, 'acc-inv');
      expect(result).toEqual([]);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AggregationsController } from './aggregations.controller';
import { AggregationsService } from './aggregations.service';
import { AuthGuard } from '../auth/auth.guard';

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

describe('AggregationsController', () => {
  let controller: AggregationsController;

  const mockUser = { id: 'user-123' } as any;

  const mockService = {
    getSummary: jest.fn().mockResolvedValue({
      netWorth: 15000,
      totalDebt: -500,
      income: 5000,
      expense: 3200,
    }),
    getSpendingByCategory: jest.fn().mockResolvedValue([
      { categoryId: 'cat-1', name: 'Groceries', color: '#4CAF50', amount: 200 },
    ]),
    getAccountBalanceHistory: jest.fn().mockResolvedValue([
      { date: '2026-04-01', balance: 100 },
      { date: '2026-04-10', balance: 200 },
    ]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AggregationsController],
      providers: [{ provide: AggregationsService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AggregationsController>(AggregationsController);
  });

  it('should return financial summary', async () => {
    const result = await controller.getSummary(mockUser, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    expect(mockService.getSummary).toHaveBeenCalledWith(
      'user-123',
      '2026-04-01',
      '2026-04-30',
    );
    expect(result).toHaveProperty('netWorth');
    expect(result).toHaveProperty('income');
    expect(result).toHaveProperty('expense');
  });

  it('should return spending by category', async () => {
    const result = await controller.getSpendingByCategory(mockUser, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('name', 'Groceries');
  });

  it('should return balance history with default 90-day window', async () => {
    await controller.getAccountBalanceHistory(mockUser, 'acc-1');
    expect(mockService.getAccountBalanceHistory).toHaveBeenCalledWith(
      'user-123',
      'acc-1',
      90,
    );
  });

  it('should pass through custom days query param', async () => {
    await controller.getAccountBalanceHistory(mockUser, 'acc-1', '30');
    expect(mockService.getAccountBalanceHistory).toHaveBeenCalledWith(
      'user-123',
      'acc-1',
      30,
    );
  });
});

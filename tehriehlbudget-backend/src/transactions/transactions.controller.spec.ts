import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AuthGuard } from '../auth/auth.guard';
import { TransactionType } from '@prisma/client';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  TransactionType: { INCOME: 'INCOME', EXPENSE: 'EXPENSE', TRANSFER: 'TRANSFER' },
  AccountType: {
    CHECKING: 'CHECKING',
    SAVINGS: 'SAVINGS',
    CREDIT: 'CREDIT',
    LOAN: 'LOAN',
    STOCK: 'STOCK',
  },
  Prisma: {},
}));

describe('TransactionsController', () => {
  let controller: TransactionsController;

  const mockUser = { id: 'user-123' } as any;
  const mockTransaction = {
    id: 'txn-1',
    userId: 'user-123',
    accountId: 'acc-1',
    amount: 42.5,
    type: TransactionType.EXPENSE,
    description: 'Grocery run',
  };

  const mockService = {
    create: jest.fn().mockResolvedValue(mockTransaction),
    findAll: jest.fn().mockResolvedValue({ data: [mockTransaction], total: 1, page: 1, limit: 20 }),
    findOne: jest.fn().mockResolvedValue(mockTransaction),
    update: jest.fn().mockResolvedValue({ ...mockTransaction, description: 'Updated' }),
    remove: jest.fn().mockResolvedValue(mockTransaction),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TransactionsController>(TransactionsController);
  });

  it('should create a transaction', async () => {
    const dto = {
      accountId: 'acc-1',
      amount: 42.5,
      type: TransactionType.EXPENSE,
      description: 'Grocery run',
      date: '2026-04-01',
    };
    const result = await controller.create(mockUser, dto);
    expect(mockService.create).toHaveBeenCalledWith('user-123', dto);
    expect(result).toEqual(mockTransaction);
  });

  it('should list transactions with pagination', async () => {
    const result = await controller.findAll(mockUser, {});
    expect(mockService.findAll).toHaveBeenCalledWith('user-123', {});
    expect(result.data).toEqual([mockTransaction]);
    expect(result.total).toBe(1);
  });

  it('should get one transaction', async () => {
    const result = await controller.findOne(mockUser, 'txn-1');
    expect(mockService.findOne).toHaveBeenCalledWith('user-123', 'txn-1');
    expect(result).toEqual(mockTransaction);
  });

  it('should update a transaction', async () => {
    const result = await controller.update(mockUser, 'txn-1', { description: 'Updated' });
    expect(mockService.update).toHaveBeenCalledWith('user-123', 'txn-1', { description: 'Updated' });
    expect(result.description).toBe('Updated');
  });

  it('should remove a transaction', async () => {
    const result = await controller.remove(mockUser, 'txn-1');
    expect(mockService.remove).toHaveBeenCalledWith('user-123', 'txn-1');
    expect(result).toEqual(mockTransaction);
  });
});

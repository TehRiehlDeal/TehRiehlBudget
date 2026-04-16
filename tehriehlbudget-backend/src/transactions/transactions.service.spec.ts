import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { TransactionType } from '@prisma/client';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  TransactionType: { INCOME: 'INCOME', EXPENSE: 'EXPENSE', TRANSFER: 'TRANSFER' },
  Prisma: {},
}));

describe('TransactionsService', () => {
  let service: TransactionsService;

  const userId = 'user-123';
  const mockTransaction = {
    id: 'txn-1',
    userId,
    accountId: 'acc-1',
    destinationAccountId: null,
    categoryId: 'cat-1',
    amount: 42.5,
    type: TransactionType.EXPENSE,
    description: 'Grocery run',
    notes: null,
    date: new Date('2026-04-01'),
    receiptPath: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const makeTxClient = () => ({
    transaction: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    account: {
      update: jest.fn(),
    },
  });

  const mockPrisma: any = {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) => cb(txClient)),
  };

  let txClient: ReturnType<typeof makeTxClient>;

  const mockEncryption = {
    encryptField: jest.fn((v: string | null) => v),
    decryptField: jest.fn((v: string | null) => v),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    txClient = makeTxClient();
    mockPrisma.$transaction = jest.fn(async (cb: any) => cb(txClient));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EncryptionService, useValue: mockEncryption },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe('create', () => {
    it('should create a standard expense transaction without touching balances', async () => {
      txClient.transaction.create.mockResolvedValue(mockTransaction);
      const dto = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        amount: 42.5,
        type: TransactionType.EXPENSE,
        description: 'Grocery run',
        date: '2026-04-01',
      };
      const result = await service.create(userId, dto);
      expect(txClient.transaction.create).toHaveBeenCalled();
      expect(txClient.account.update).not.toHaveBeenCalled();
      expect(result.id).toBe('txn-1');
    });

    it('should require destinationAccountId for TRANSFER type', async () => {
      const dto = {
        accountId: 'acc-1',
        amount: 100,
        type: TransactionType.TRANSFER,
        description: 'Payment',
        date: '2026-04-01',
      };
      await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject transfer where source equals destination', async () => {
      const dto = {
        accountId: 'acc-1',
        destinationAccountId: 'acc-1',
        amount: 100,
        type: TransactionType.TRANSFER,
        description: 'Self transfer',
        date: '2026-04-01',
      };
      await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject transfer if either account is not owned by user', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: 'acc-1' }]);
      const dto = {
        accountId: 'acc-1',
        destinationAccountId: 'acc-2',
        amount: 100,
        type: TransactionType.TRANSFER,
        description: 'Payment',
        date: '2026-04-01',
      };
      await expect(service.create(userId, dto)).rejects.toThrow(NotFoundException);
    });

    it('should create a TRANSFER and atomically update both account balances', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-1' },
        { id: 'acc-2' },
      ]);
      const transferTxn = {
        ...mockTransaction,
        accountId: 'acc-1',
        destinationAccountId: 'acc-2',
        amount: 500,
        type: TransactionType.TRANSFER,
      };
      txClient.transaction.create.mockResolvedValue(transferTxn);

      const dto = {
        accountId: 'acc-1',
        destinationAccountId: 'acc-2',
        amount: 500,
        type: TransactionType.TRANSFER,
        description: 'Credit card payment',
        date: '2026-04-05',
      };
      const result = await service.create(userId, dto);

      expect(txClient.transaction.create).toHaveBeenCalled();
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { decrement: 500 } },
      });
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-2' },
        data: { balance: { increment: 500 } },
      });
      expect(result.type).toBe(TransactionType.TRANSFER);
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const result = await service.findAll(userId, { page: 1, limit: 20 });

      expect(result.data).toEqual([mockTransaction]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by accountId with OR for transfers on destination', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      await service.findAll(userId, { accountId: 'acc-1', page: 1, limit: 20 });

      const where = mockPrisma.transaction.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { accountId: 'acc-1' },
        { destinationAccountId: 'acc-1' },
      ]);
    });

    it('should filter by date range', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await service.findAll(userId, {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        page: 1,
        limit: 20,
      });

      const where = mockPrisma.transaction.findMany.mock.calls[0][0].where;
      expect(where.date).toBeDefined();
      expect(where.date.gte).toEqual(new Date('2026-04-01'));
      expect(where.date.lte).toEqual(new Date('2026-04-30'));
    });
  });

  describe('findOne', () => {
    it('should return a single transaction', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      const result = await service.findOne(userId, 'txn-1');
      expect(result.id).toBe('txn-1');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a non-transfer transaction', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      txClient.transaction.update.mockResolvedValue({
        ...mockTransaction,
        description: 'Updated',
      });
      const result = await service.update(userId, 'txn-1', { description: 'Updated' });
      expect(result.description).toBe('Updated');
      expect(txClient.account.update).not.toHaveBeenCalled();
    });

    it('should reverse old and apply new balances when editing a transfer amount', async () => {
      const existing = {
        ...mockTransaction,
        accountId: 'acc-1',
        destinationAccountId: 'acc-2',
        amount: 100,
        type: TransactionType.TRANSFER,
      };
      mockPrisma.transaction.findFirst.mockResolvedValue(existing);
      txClient.transaction.update.mockResolvedValue({
        ...existing,
        amount: 150,
      });

      await service.update(userId, 'txn-1', { amount: 150 });

      // Old effect reversed
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 100 } },
      });
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-2' },
        data: { balance: { decrement: 100 } },
      });
      // New effect applied
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { decrement: 150 } },
      });
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-2' },
        data: { balance: { increment: 150 } },
      });
    });
  });

  describe('remove', () => {
    it('should delete a non-transfer transaction without touching balances', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      txClient.transaction.delete.mockResolvedValue(mockTransaction);
      await service.remove(userId, 'txn-1');
      expect(txClient.account.update).not.toHaveBeenCalled();
    });

    it('should reverse the transfer balance effect when deleting a transfer', async () => {
      const transferTxn = {
        ...mockTransaction,
        accountId: 'acc-1',
        destinationAccountId: 'acc-2',
        amount: 200,
        type: TransactionType.TRANSFER,
      };
      mockPrisma.transaction.findFirst.mockResolvedValue(transferTxn);
      txClient.transaction.delete.mockResolvedValue(transferTxn);

      await service.remove(userId, 'txn-1');

      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 200 } },
      });
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-2' },
        data: { balance: { decrement: 200 } },
      });
    });

    it('should throw NotFoundException when deleting a missing transaction', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      await expect(service.remove(userId, 'nope')).rejects.toThrow(NotFoundException);
    });
  });
});

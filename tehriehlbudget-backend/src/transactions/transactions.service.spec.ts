import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { TransactionType, AccountType } from '@prisma/client';

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

describe('TransactionsService', () => {
  let service: TransactionsService;

  const userId = 'user-123';
  const baseTxn = {
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
      findMany: jest.fn(),
    },
  });

  const mockPrisma: any = {
    transaction: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
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
    it('should decrement an asset account for an EXPENSE transaction', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', type: AccountType.CHECKING },
      ]);
      txClient.transaction.create.mockResolvedValue({
        ...baseTxn,
        type: TransactionType.EXPENSE,
        amount: 42.5,
      });

      await service.create(userId, {
        accountId: 'acc-1',
        amount: 42.5,
        type: TransactionType.EXPENSE,
        description: 'Grocery run',
        date: '2026-04-01',
      });

      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { decrement: 42.5 } },
      });
    });

    it('should increment an asset account for an INCOME transaction', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', type: AccountType.CHECKING },
      ]);
      txClient.transaction.create.mockResolvedValue({ ...baseTxn, type: TransactionType.INCOME, amount: 3000 });

      await service.create(userId, {
        accountId: 'acc-1',
        amount: 3000,
        type: TransactionType.INCOME,
        description: 'Paycheck',
        date: '2026-04-01',
      });

      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 3000 } },
      });
    });

    it('should INCREMENT credit card balance for an EXPENSE (new charge)', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-cc', type: AccountType.CREDIT },
      ]);
      txClient.transaction.create.mockResolvedValue({ ...baseTxn, accountId: 'acc-cc', amount: 50 });

      await service.create(userId, {
        accountId: 'acc-cc',
        amount: 50,
        type: TransactionType.EXPENSE,
        description: 'Coffee',
        date: '2026-04-01',
      });

      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-cc' },
        data: { balance: { increment: 50 } },
      });
    });

    it('should DECREMENT credit card balance for an INCOME (refund/payment)', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-cc', type: AccountType.CREDIT },
      ]);
      txClient.transaction.create.mockResolvedValue({ ...baseTxn, accountId: 'acc-cc', type: TransactionType.INCOME, amount: 25 });

      await service.create(userId, {
        accountId: 'acc-cc',
        amount: 25,
        type: TransactionType.INCOME,
        description: 'Refund',
        date: '2026-04-01',
      });

      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-cc' },
        data: { balance: { decrement: 25 } },
      });
    });

    it('should pay down a credit card via TRANSFER: decrement source, decrement liability destination', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', type: AccountType.CHECKING },
        { id: 'acc-cc', type: AccountType.CREDIT },
      ]);
      txClient.transaction.create.mockResolvedValue({
        ...baseTxn,
        accountId: 'acc-1',
        destinationAccountId: 'acc-cc',
        amount: 500,
        type: TransactionType.TRANSFER,
      });

      await service.create(userId, {
        accountId: 'acc-1',
        destinationAccountId: 'acc-cc',
        amount: 500,
        type: TransactionType.TRANSFER,
        description: 'Credit card payment',
        date: '2026-04-05',
      });

      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { decrement: 500 } },
      });
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-cc' },
        data: { balance: { decrement: 500 } },
      });
    });

    it('should require destinationAccountId for TRANSFER', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', type: AccountType.CHECKING },
      ]);
      await expect(
        service.create(userId, {
          accountId: 'acc-1',
          amount: 100,
          type: TransactionType.TRANSFER,
          description: 'Bad',
          date: '2026-04-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unowned accounts', async () => {
      mockPrisma.account.findMany.mockResolvedValue([]);
      await expect(
        service.create(userId, {
          accountId: 'stranger',
          amount: 100,
          type: TransactionType.EXPENSE,
          description: 'x',
          date: '2026-04-01',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('filters accountId with OR so transfers show on destination side', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);
      await service.findAll(userId, { accountId: 'acc-1', page: 1, limit: 20 });
      const where = mockPrisma.transaction.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ accountId: 'acc-1' }, { destinationAccountId: 'acc-1' }]);
    });
  });

  describe('update', () => {
    it('should reverse and reapply balance when editing an EXPENSE amount', async () => {
      const existing = {
        ...baseTxn,
        type: TransactionType.EXPENSE,
        amount: 100,
      };
      mockPrisma.transaction.findFirst.mockResolvedValue(existing);
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', type: AccountType.CHECKING },
      ]);
      txClient.transaction.update.mockResolvedValue({ ...existing, amount: 150 });

      await service.update(userId, 'txn-1', { amount: 150 });

      // Reverse old $100 expense on asset = +100
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 100 } },
      });
      // Apply new $150 expense on asset = -150
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { decrement: 150 } },
      });
    });

    it('should handle editing a transfer amount with liability destination', async () => {
      const existing = {
        ...baseTxn,
        accountId: 'acc-1',
        destinationAccountId: 'acc-cc',
        amount: 100,
        type: TransactionType.TRANSFER,
      };
      mockPrisma.transaction.findFirst.mockResolvedValue(existing);
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', type: AccountType.CHECKING },
        { id: 'acc-cc', type: AccountType.CREDIT },
      ]);
      txClient.transaction.update.mockResolvedValue({ ...existing, amount: 150 });

      await service.update(userId, 'txn-1', { amount: 150 });

      // Reverse: checking +100, credit +100
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 100 } },
      });
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-cc' },
        data: { balance: { increment: 100 } },
      });
      // Apply: checking -150, credit -150
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { decrement: 150 } },
      });
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-cc' },
        data: { balance: { decrement: 150 } },
      });
    });

    it('should not touch balances when only non-balance fields change', async () => {
      const existing = { ...baseTxn, type: TransactionType.EXPENSE, amount: 100 };
      mockPrisma.transaction.findFirst.mockResolvedValue(existing);
      txClient.transaction.update.mockResolvedValue({ ...existing, description: 'Updated' });

      await service.update(userId, 'txn-1', { description: 'Updated' });

      expect(txClient.account.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should reverse an EXPENSE on delete', async () => {
      const existing = { ...baseTxn, type: TransactionType.EXPENSE, amount: 100 };
      mockPrisma.transaction.findFirst.mockResolvedValue(existing);
      txClient.account.findMany.mockResolvedValue([
        { id: 'acc-1', type: AccountType.CHECKING },
      ]);
      txClient.transaction.delete.mockResolvedValue(existing);

      await service.remove(userId, 'txn-1');

      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 100 } },
      });
    });

    it('should reverse an INCOME on a liability (a refund) on delete', async () => {
      const existing = {
        ...baseTxn,
        accountId: 'acc-cc',
        type: TransactionType.INCOME,
        amount: 25,
      };
      mockPrisma.transaction.findFirst.mockResolvedValue(existing);
      txClient.account.findMany.mockResolvedValue([
        { id: 'acc-cc', type: AccountType.CREDIT },
      ]);
      txClient.transaction.delete.mockResolvedValue(existing);

      await service.remove(userId, 'txn-1');

      // Income on CREDIT originally decremented debt → reverse increments
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-cc' },
        data: { balance: { increment: 25 } },
      });
    });

    it('should reverse both sides of a TRANSFER delete', async () => {
      const existing = {
        ...baseTxn,
        accountId: 'acc-1',
        destinationAccountId: 'acc-cc',
        amount: 200,
        type: TransactionType.TRANSFER,
      };
      mockPrisma.transaction.findFirst.mockResolvedValue(existing);
      txClient.account.findMany.mockResolvedValue([
        { id: 'acc-1', type: AccountType.CHECKING },
        { id: 'acc-cc', type: AccountType.CREDIT },
      ]);
      txClient.transaction.delete.mockResolvedValue(existing);

      await service.remove(userId, 'txn-1');

      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 200 } },
      });
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-cc' },
        data: { balance: { increment: 200 } },
      });
    });

    it('should throw NotFoundException when deleting a missing transaction', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      await expect(service.remove(userId, 'nope')).rejects.toThrow(NotFoundException);
    });
  });
});

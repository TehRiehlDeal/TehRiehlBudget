import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { AccountType, TransactionType } from '@prisma/client';

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

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: PrismaService;

  const userId = 'user-123';
  const mockAccount = {
    id: 'acc-1',
    userId,
    name: 'Main Checking',
    type: AccountType.CHECKING,
    balance: 5000,
    institution: 'BECU',
    accountNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const makeTxClient = () => ({
    transaction: {
      findMany: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  });

  let txClient: ReturnType<typeof makeTxClient>;

  const mockPrisma: any = {
    account: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
    },
    $transaction: jest.fn(),
  };

  const mockEncryption = {
    encryptField: jest.fn((v: string | null) => v),
    decryptField: jest.fn((v: string | null) => v),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    txClient = makeTxClient();
    // Support both array form (reorder uses promises) and callback form (remove uses cb).
    mockPrisma.$transaction = jest.fn(async (arg: any) =>
      typeof arg === 'function' ? arg(txClient) : Promise.all(arg),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EncryptionService, useValue: mockEncryption },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create an account for the user', async () => {
      mockPrisma.account.create.mockResolvedValue(mockAccount);

      const result = await service.create(userId, {
        name: 'Main Checking',
        type: AccountType.CHECKING,
        balance: 5000,
        institution: 'BECU',
      });

      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: 'Main Checking',
          type: AccountType.CHECKING,
          balance: 5000,
          institution: 'BECU',
          sortOrder: 0,
        },
      });
      expect(result).toEqual(mockAccount);
    });

    it('should assign sortOrder as max+1 when other accounts exist', async () => {
      mockPrisma.account.aggregate.mockResolvedValueOnce({
        _max: { sortOrder: 4 },
      });
      mockPrisma.account.create.mockResolvedValue(mockAccount);

      await service.create(userId, {
        name: 'New',
        type: AccountType.SAVINGS,
      });

      expect(mockPrisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortOrder: 5 }) }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all accounts ordered by sortOrder then createdAt', async () => {
      mockPrisma.account.findMany.mockResolvedValue([mockAccount]);

      const result = await service.findAll(userId);

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
      expect(result).toEqual([mockAccount]);
    });
  });

  describe('reorder', () => {
    it('should update sortOrder for each account in order', async () => {
      mockPrisma.account.findMany
        .mockResolvedValueOnce([
          { id: 'a' },
          { id: 'b' },
          { id: 'c' },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.account.update.mockResolvedValue({});

      await service.reorder(userId, ['c', 'a', 'b']);

      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'c' },
        data: { sortOrder: 0 },
      });
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'a' },
        data: { sortOrder: 1 },
      });
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'b' },
        data: { sortOrder: 2 },
      });
    });

    it('should throw BadRequest if any id does not belong to user', async () => {
      mockPrisma.account.findMany.mockResolvedValueOnce([
        { id: 'a' },
        { id: 'b' },
      ]);
      await expect(
        service.reorder(userId, ['a', 'b', 'stranger']),
      ).rejects.toThrow();
    });
  });

  describe('findOne', () => {
    it('should return a single account owned by the user', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);

      const result = await service.findOne(userId, 'acc-1');

      expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: 'acc-1', userId },
      });
      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException if account not found', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an account owned by the user', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      mockPrisma.account.update.mockResolvedValue({ ...mockAccount, name: 'Updated' });

      const result = await service.update(userId, 'acc-1', { name: 'Updated' });

      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { name: 'Updated' },
      });
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException if account not found', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(service.update(userId, 'nonexistent', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if account not found', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should delete an account with no related transactions without touching other balances', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      txClient.transaction.findMany.mockResolvedValue([]);
      txClient.account.findMany.mockResolvedValue([]);
      txClient.account.delete.mockResolvedValue(mockAccount);

      const result = await service.remove(userId, 'acc-1');

      expect(txClient.account.update).not.toHaveBeenCalled();
      expect(txClient.account.delete).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
      });
      expect(result).toEqual(mockAccount);
    });

    it('should not touch counter-party balances for INCOME/EXPENSE transactions', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      txClient.transaction.findMany.mockResolvedValue([
        {
          id: 't1',
          userId,
          accountId: 'acc-1',
          destinationAccountId: null,
          type: TransactionType.EXPENSE,
          amount: 50,
        },
        {
          id: 't2',
          userId,
          accountId: 'acc-1',
          destinationAccountId: null,
          type: TransactionType.INCOME,
          amount: 200,
        },
      ]);
      txClient.account.findMany.mockResolvedValue([]);
      txClient.account.delete.mockResolvedValue(mockAccount);

      await service.remove(userId, 'acc-1');

      expect(txClient.account.update).not.toHaveBeenCalled();
      expect(txClient.account.delete).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
      });
    });

    it('should reverse a TRANSFER on the surviving destination when the source account is deleted', async () => {
      // Source: Checking (acc-1). Destination: Savings (acc-2, asset).
      // Transfer of $100 had credited Savings +100. Deleting Checking must debit Savings -100.
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      txClient.transaction.findMany.mockResolvedValue([
        {
          id: 't1',
          userId,
          accountId: 'acc-1',
          destinationAccountId: 'acc-2',
          type: TransactionType.TRANSFER,
          amount: 100,
        },
      ]);
      txClient.account.findMany.mockResolvedValue([
        { id: 'acc-2', type: AccountType.SAVINGS },
      ]);
      txClient.account.delete.mockResolvedValue(mockAccount);

      await service.remove(userId, 'acc-1');

      expect(txClient.account.update).toHaveBeenCalledTimes(1);
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-2' },
        data: { balance: { decrement: 100 } },
      });
      expect(txClient.account.delete).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
      });
    });

    it('should reverse a TRANSFER on the surviving source when the destination account is deleted', async () => {
      // Source: Checking (acc-2, asset). Destination: Savings (acc-1) being deleted.
      // Transfer had debited Checking -100. Deleting Savings must credit Checking +100.
      mockPrisma.account.findFirst.mockResolvedValue({
        ...mockAccount,
        id: 'acc-1',
        type: AccountType.SAVINGS,
      });
      txClient.transaction.findMany.mockResolvedValue([
        {
          id: 't1',
          userId,
          accountId: 'acc-2',
          destinationAccountId: 'acc-1',
          type: TransactionType.TRANSFER,
          amount: 100,
        },
      ]);
      txClient.account.findMany.mockResolvedValue([
        { id: 'acc-2', type: AccountType.CHECKING },
      ]);
      txClient.account.delete.mockResolvedValue(mockAccount);

      await service.remove(userId, 'acc-1');

      expect(txClient.account.update).toHaveBeenCalledTimes(1);
      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-2' },
        data: { balance: { increment: 100 } },
      });
    });

    it('should correctly reverse a TRANSFER where the counter-party is a LIABILITY (credit card paid off)', async () => {
      // Source: Checking (acc-1, asset) being deleted. Destination: Credit (acc-2, liability).
      // The transfer had reduced credit debt (-100 to liability balance).
      // Deleting Checking must restore the debt (+100 to liability balance).
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      txClient.transaction.findMany.mockResolvedValue([
        {
          id: 't1',
          userId,
          accountId: 'acc-1',
          destinationAccountId: 'acc-2',
          type: TransactionType.TRANSFER,
          amount: 100,
        },
      ]);
      txClient.account.findMany.mockResolvedValue([
        { id: 'acc-2', type: AccountType.CREDIT },
      ]);
      txClient.account.delete.mockResolvedValue(mockAccount);

      await service.remove(userId, 'acc-1');

      expect(txClient.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-2' },
        data: { balance: { increment: 100 } },
      });
    });

    it('should skip self-transfers where both sides are the deleted account', async () => {
      // Edge case — no counter-party to fix.
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      txClient.transaction.findMany.mockResolvedValue([
        {
          id: 't1',
          userId,
          accountId: 'acc-1',
          destinationAccountId: 'acc-1',
          type: TransactionType.TRANSFER,
          amount: 100,
        },
      ]);
      txClient.account.findMany.mockResolvedValue([]);
      txClient.account.delete.mockResolvedValue(mockAccount);

      await service.remove(userId, 'acc-1');

      expect(txClient.account.update).not.toHaveBeenCalled();
    });

    it('should reverse balances BEFORE deleting the account in the same $transaction', async () => {
      // Ordering matters: if the account row is deleted before the update,
      // Prisma cascade will already have wiped the transactions.
      const callOrder: string[] = [];
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      txClient.transaction.findMany.mockResolvedValue([
        {
          id: 't1',
          userId,
          accountId: 'acc-1',
          destinationAccountId: 'acc-2',
          type: TransactionType.TRANSFER,
          amount: 100,
        },
      ]);
      txClient.account.findMany.mockResolvedValue([
        { id: 'acc-2', type: AccountType.SAVINGS },
      ]);
      txClient.account.update.mockImplementation(async () => {
        callOrder.push('update');
      });
      txClient.account.delete.mockImplementation(async () => {
        callOrder.push('delete');
        return mockAccount;
      });

      await service.remove(userId, 'acc-1');

      expect(callOrder).toEqual(['update', 'delete']);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});

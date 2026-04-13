import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { TransactionType } from '@prisma/client';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  TransactionType: { INCOME: 'INCOME', EXPENSE: 'EXPENSE', TRANSFER: 'TRANSFER' },
}));

describe('TransactionsService', () => {
  let service: TransactionsService;

  const userId = 'user-123';
  const mockTransaction = {
    id: 'txn-1',
    userId,
    accountId: 'acc-1',
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

  const mockPrisma = {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockEncryption = {
    encryptField: jest.fn((v: string | null) => v),
    decryptField: jest.fn((v: string | null) => v),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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
    it('should create a transaction', async () => {
      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);
      const dto = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        amount: 42.5,
        type: TransactionType.EXPENSE,
        description: 'Grocery run',
        date: '2026-04-01',
      };
      const result = await service.create(userId, dto);
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: {
          userId,
          ...dto,
          date: new Date('2026-04-01'),
        },
        include: { category: true, account: true },
      });
      expect(result).toEqual(mockTransaction);
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

    it('should filter by accountId', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      await service.findAll(userId, { accountId: 'acc-1', page: 1, limit: 20 });

      const where = mockPrisma.transaction.findMany.mock.calls[0][0].where;
      expect(where.accountId).toBe('acc-1');
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
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a transaction', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      mockPrisma.transaction.update.mockResolvedValue({ ...mockTransaction, description: 'Updated' });
      const result = await service.update(userId, 'txn-1', { description: 'Updated' });
      expect(result.description).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should delete a transaction', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      mockPrisma.transaction.delete.mockResolvedValue(mockTransaction);
      const result = await service.remove(userId, 'txn-1');
      expect(result).toEqual(mockTransaction);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { AccountType } from '@prisma/client';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  AccountType: {
    CHECKING: 'CHECKING',
    SAVINGS: 'SAVINGS',
    CREDIT: 'CREDIT',
    LOAN: 'LOAN',
    STOCK: 'STOCK',
  },
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

  const mockPrisma = {
    account: {
      create: jest.fn(),
      findMany: jest.fn(),
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
        },
      });
      expect(result).toEqual(mockAccount);
    });
  });

  describe('findAll', () => {
    it('should return all accounts for the user', async () => {
      mockPrisma.account.findMany.mockResolvedValue([mockAccount]);

      const result = await service.findAll(userId);

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockAccount]);
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
    it('should delete an account owned by the user', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      mockPrisma.account.delete.mockResolvedValue(mockAccount);

      const result = await service.remove(userId, 'acc-1');

      expect(mockPrisma.account.delete).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
      });
      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException if account not found', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

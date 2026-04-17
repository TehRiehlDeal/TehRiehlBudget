import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ValuationsService } from './valuations.service';
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
}));

describe('ValuationsService', () => {
  let service: ValuationsService;

  const userId = 'user-1';
  const accountId = 'acc-1';

  const mockPrisma: any = {
    account: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    accountValuation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValuationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ValuationsService>(ValuationsService);
  });

  describe('create', () => {
    it('creates a valuation and sets the account balance to the latest value', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({ id: accountId });
      mockPrisma.accountValuation.create.mockResolvedValue({
        id: 'v-1',
        accountId,
        date: new Date('2026-04-17'),
        value: 52340,
      });
      mockPrisma.accountValuation.findFirst.mockResolvedValue({
        id: 'v-1',
        accountId,
        date: new Date('2026-04-17'),
        value: 52340,
      });

      const created = await service.create(userId, accountId, {
        date: '2026-04-17',
        value: 52340,
      });

      expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: accountId, userId },
      });
      expect(mockPrisma.accountValuation.create).toHaveBeenCalledWith({
        data: {
          accountId,
          date: expect.any(Date),
          value: 52340,
        },
      });
      // recomputeBalance queries for the latest and writes to the account
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { balance: 52340 },
      });
      expect(created.value).toBe(52340);
    });

    it('rejects an account not owned by the user', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      await expect(
        service.create(userId, 'stranger-account', { date: '2026-04-17', value: 1 }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.accountValuation.create).not.toHaveBeenCalled();
    });

    it('stores the date at noon UTC to avoid off-by-one day bugs', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({ id: accountId });
      mockPrisma.accountValuation.create.mockResolvedValue({});
      mockPrisma.accountValuation.findFirst.mockResolvedValue(null);

      await service.create(userId, accountId, { date: '2026-04-17', value: 100 });

      const call = mockPrisma.accountValuation.create.mock.calls[0][0];
      const stored: Date = call.data.date;
      expect(stored.toISOString()).toBe('2026-04-17T12:00:00.000Z');
    });
  });

  describe('list', () => {
    it('returns valuations in chronological order within the window', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({ id: accountId });
      const rows = [
        { id: 'v1', date: new Date('2026-04-01'), value: 100 },
        { id: 'v2', date: new Date('2026-04-10'), value: 120 },
      ];
      mockPrisma.accountValuation.findMany.mockResolvedValue(rows);

      const result = await service.list(userId, accountId, 30);

      expect(mockPrisma.accountValuation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accountId }),
          orderBy: { date: 'asc' },
        }),
      );
      expect(result).toEqual(rows);
    });

    it('rejects an account not owned by the user', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      await expect(service.list(userId, 'stranger', 30)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a valuation and recomputes the account balance to the next latest', async () => {
      mockPrisma.accountValuation.findFirst.mockResolvedValueOnce({
        id: 'v-latest',
        accountId,
        value: 300,
        account: { userId },
      });
      mockPrisma.accountValuation.delete.mockResolvedValue({});
      // After deletion, the next latest is v-prior at $200
      mockPrisma.accountValuation.findFirst.mockResolvedValueOnce({
        id: 'v-prior',
        accountId,
        value: 200,
      });

      await service.remove(userId, 'v-latest');

      expect(mockPrisma.accountValuation.delete).toHaveBeenCalledWith({
        where: { id: 'v-latest' },
      });
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { balance: 200 },
      });
    });

    it('leaves the account balance untouched if no valuations remain', async () => {
      mockPrisma.accountValuation.findFirst.mockResolvedValueOnce({
        id: 'v-only',
        accountId,
        value: 300,
        account: { userId },
      });
      mockPrisma.accountValuation.delete.mockResolvedValue({});
      mockPrisma.accountValuation.findFirst.mockResolvedValueOnce(null);

      await service.remove(userId, 'v-only');

      expect(mockPrisma.account.update).not.toHaveBeenCalled();
    });

    it('rejects deleting a valuation owned by another user', async () => {
      mockPrisma.accountValuation.findFirst.mockResolvedValue(null);
      await expect(service.remove(userId, 'stranger-v')).rejects.toThrow(NotFoundException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ActivityLogService } from './activity-log.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  EntityType: {
    TRANSACTION: 'TRANSACTION',
    ACCOUNT: 'ACCOUNT',
    ACCOUNT_VALUATION: 'ACCOUNT_VALUATION',
  },
  ActivityAction: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' },
}));

import { EntityType, ActivityAction } from '@prisma/client';

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  const userId = 'user-1';

  const mockPrisma: any = {
    activityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ActivityLogService>(ActivityLogService);
  });

  describe('log', () => {
    it('creates an activity row with all fields populated', async () => {
      mockPrisma.activityLog.create.mockResolvedValue({});

      await service.log({
        userId,
        entityType: EntityType.TRANSACTION,
        entityId: 'txn-1',
        action: ActivityAction.CREATE,
        accountId: 'acc-1',
        destinationAccountId: 'acc-2',
        summary: '$50.00 EXPENSE — Coffee',
        snapshot: { id: 'txn-1', amount: 50, type: 'EXPENSE' },
      });

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          entityType: EntityType.TRANSACTION,
          entityId: 'txn-1',
          action: ActivityAction.CREATE,
          accountId: 'acc-1',
          destinationAccountId: 'acc-2',
          summary: '$50.00 EXPENSE — Coffee',
          snapshot: { id: 'txn-1', amount: 50, type: 'EXPENSE' },
        },
      });
    });

    it('honors a passed tx client and skips the default prisma client', async () => {
      const tx: any = { activityLog: { create: jest.fn().mockResolvedValue({}) } };

      await service.log({
        userId,
        entityType: EntityType.ACCOUNT,
        entityId: 'acc-1',
        action: ActivityAction.DELETE,
        tx,
      });

      expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.activityLog.create).not.toHaveBeenCalled();
    });

    it('falls back to prisma when no tx is provided', async () => {
      mockPrisma.activityLog.create.mockResolvedValue({});

      await service.log({
        userId,
        entityType: EntityType.ACCOUNT,
        entityId: 'acc-1',
        action: ActivityAction.UPDATE,
      });

      expect(mockPrisma.activityLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('returns paginated rows newest first with default page/limit', async () => {
      const rows = [{ id: 'a' }, { id: 'b' }];
      mockPrisma.activityLog.findMany.mockResolvedValue(rows);
      mockPrisma.activityLog.count.mockResolvedValue(2);

      const result = await service.findAll(userId, {});

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: rows, total: 2, page: 1, limit: 20 });
    });

    it('filters by entityType', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      await service.findAll(userId, { entityType: EntityType.TRANSACTION });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, entityType: EntityType.TRANSACTION },
        }),
      );
    });

    it('filters by action', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      await service.findAll(userId, { action: ActivityAction.DELETE });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, action: ActivityAction.DELETE },
        }),
      );
    });

    it('filters by accountId across primary OR destination', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      await service.findAll(userId, { accountId: 'acc-1' });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            OR: [
              { accountId: 'acc-1' },
              { destinationAccountId: 'acc-1' },
            ],
          },
        }),
      );
    });

    it('filters by date range', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      await service.findAll(userId, {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      });

      const call = mockPrisma.activityLog.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte).toEqual(new Date('2026-04-01'));
      expect(call.where.createdAt.lte).toEqual(new Date('2026-04-30'));
    });

    it('paginates with custom page and limit', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(50);

      await service.findAll(userId, { page: 3, limit: 10 });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });
});

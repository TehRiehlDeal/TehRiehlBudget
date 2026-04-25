import { Injectable } from '@nestjs/common';
import { Prisma, EntityType, ActivityAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LogInput {
  userId: string;
  entityType: EntityType;
  entityId: string;
  action: ActivityAction;
  accountId?: string | null;
  destinationAccountId?: string | null;
  summary?: string;
  snapshot?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
}

export interface ActivityLogFilters {
  entityType?: EntityType;
  action?: ActivityAction;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async log(input: LogInput): Promise<void> {
    const {
      tx,
      userId,
      entityType,
      entityId,
      action,
      accountId,
      destinationAccountId,
      summary,
      snapshot,
    } = input;

    const data: any = { userId, entityType, entityId, action };
    if (accountId !== undefined) data.accountId = accountId;
    if (destinationAccountId !== undefined) {
      data.destinationAccountId = destinationAccountId;
    }
    if (summary !== undefined) data.summary = summary;
    if (snapshot !== undefined) data.snapshot = snapshot;

    const client = tx ?? this.prisma;
    await client.activityLog.create({ data });
  }

  async findAll(userId: string, filters: ActivityLogFilters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: Prisma.ActivityLogWhereInput = { userId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.action) where.action = filters.action;
    if (filters.accountId) {
      where.OR = [
        { accountId: filters.accountId },
        { destinationAccountId: filters.accountId },
      ];
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as any).gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        (where.createdAt as any).lte = new Date(filters.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionType, AccountType, Prisma } from '@prisma/client';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

const txnInclude = {
  category: true,
  account: true,
  destinationAccount: true,
} as const;

const LIABILITY_TYPES: AccountType[] = [
  AccountType.CREDIT,
  AccountType.LOAN,
];

/**
 * Determines how a transfer affects an account's balance.
 *
 * Asset accounts (CHECKING, SAVINGS, STOCK): positive balance = you have money
 *   - money flowing OUT (source): balance decreases
 *   - money flowing IN (destination): balance increases
 *
 * Liability accounts (CREDIT, LOAN): positive balance = debt owed
 *   - money flowing OUT (source, e.g., cash advance): balance increases (more debt)
 *   - money flowing IN (destination, e.g., payment): balance decreases (less debt)
 */
function transferDelta(
  accountType: AccountType,
  role: 'source' | 'destination',
  amount: number,
): { increment: number } | { decrement: number } {
  const isLiability = LIABILITY_TYPES.includes(accountType);
  const assetIncrements = role === 'destination';
  const shouldIncrement = isLiability ? !assetIncrements : assetIncrements;
  return shouldIncrement ? { increment: amount } : { decrement: amount };
}

/** Returns the reversed delta for undoing a prior transfer. */
function reverseTransferDelta(
  accountType: AccountType,
  role: 'source' | 'destination',
  amount: number,
): { increment: number } | { decrement: number } {
  const forward = transferDelta(accountType, role, amount);
  return 'increment' in forward
    ? { decrement: forward.increment }
    : { increment: forward.decrement };
}

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    const data: any = {
      userId,
      ...dto,
      date: new Date(dto.date),
    };
    if (data.notes) {
      data.notes = this.encryption.encryptField(data.notes)!;
    }

    let sourceAccount: { id: string; type: AccountType } | undefined;
    let destAccount: { id: string; type: AccountType } | undefined;

    if (dto.type === TransactionType.TRANSFER) {
      if (!dto.destinationAccountId) {
        throw new BadRequestException(
          'destinationAccountId is required for TRANSFER transactions',
        );
      }
      if (dto.destinationAccountId === dto.accountId) {
        throw new BadRequestException(
          'Source and destination accounts must differ',
        );
      }
      const accounts = await this.prisma.account.findMany({
        where: { userId, id: { in: [dto.accountId, dto.destinationAccountId] } },
        select: { id: true, type: true },
      });
      if (accounts.length !== 2) {
        throw new NotFoundException('One or both accounts not found');
      }
      sourceAccount = accounts.find((a) => a.id === dto.accountId);
      destAccount = accounts.find((a) => a.id === dto.destinationAccountId);
    } else {
      data.destinationAccountId = null;
    }

    const txn = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data,
        include: txnInclude,
      });
      if (sourceAccount && destAccount) {
        await tx.account.update({
          where: { id: sourceAccount.id },
          data: { balance: transferDelta(sourceAccount.type, 'source', dto.amount) },
        });
        await tx.account.update({
          where: { id: destAccount.id },
          data: { balance: transferDelta(destAccount.type, 'destination', dto.amount) },
        });
      }
      return created;
    });
    return this.decryptTransaction(txn);
  }

  async findAll(userId: string, filters: TransactionFilters) {
    const { accountId, categoryId, type, startDate, endDate } = filters;
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: Prisma.TransactionWhereInput = { userId };

    if (accountId) {
      where.OR = [
        { accountId },
        { destinationAccountId: accountId },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as any).gte = new Date(startDate);
      if (endDate) (where.date as any).lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: txnInclude,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data: data.map((t) => this.decryptTransaction(t)), total, page, limit };
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: txnInclude,
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return this.decryptTransaction(transaction);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    const data: any = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    if (data.notes !== undefined) {
      data.notes = this.encryption.encryptField(data.notes);
    }

    const wasTransfer = existing.type === TransactionType.TRANSFER;
    const willBeTransfer =
      (dto.type ?? existing.type) === TransactionType.TRANSFER;

    const transferAffected =
      wasTransfer ||
      willBeTransfer ||
      dto.amount !== undefined ||
      dto.accountId !== undefined ||
      dto.destinationAccountId !== undefined;

    // Pre-fetch account types we may need
    const accountIdsNeeded = new Set<string>();
    if (wasTransfer && existing.destinationAccountId) {
      accountIdsNeeded.add(existing.accountId);
      accountIdsNeeded.add(existing.destinationAccountId);
    }
    if (willBeTransfer) {
      accountIdsNeeded.add(dto.accountId ?? existing.accountId);
      const destId = dto.destinationAccountId ?? existing.destinationAccountId;
      if (destId) accountIdsNeeded.add(destId);
    }
    const accounts = accountIdsNeeded.size
      ? await this.prisma.account.findMany({
          where: { userId, id: { in: Array.from(accountIdsNeeded) } },
          select: { id: true, type: true },
        })
      : [];
    const typeById = new Map(accounts.map((a) => [a.id, a.type]));

    const txn = await this.prisma.$transaction(async (tx) => {
      // Reverse the old transfer effect if this was a transfer
      if (wasTransfer && existing.destinationAccountId && transferAffected) {
        const oldSrcType = typeById.get(existing.accountId);
        const oldDstType = typeById.get(existing.destinationAccountId);
        if (oldSrcType && oldDstType) {
          await tx.account.update({
            where: { id: existing.accountId },
            data: {
              balance: reverseTransferDelta(
                oldSrcType,
                'source',
                Number(existing.amount),
              ),
            },
          });
          await tx.account.update({
            where: { id: existing.destinationAccountId },
            data: {
              balance: reverseTransferDelta(
                oldDstType,
                'destination',
                Number(existing.amount),
              ),
            },
          });
        }
      }

      const updated = await tx.transaction.update({
        where: { id },
        data,
        include: txnInclude,
      });

      if (willBeTransfer && updated.destinationAccountId && transferAffected) {
        const newSrcType = typeById.get(updated.accountId);
        const newDstType = typeById.get(updated.destinationAccountId);
        if (newSrcType && newDstType) {
          await tx.account.update({
            where: { id: updated.accountId },
            data: {
              balance: transferDelta(
                newSrcType,
                'source',
                Number(updated.amount),
              ),
            },
          });
          await tx.account.update({
            where: { id: updated.destinationAccountId },
            data: {
              balance: transferDelta(
                newDstType,
                'destination',
                Number(updated.amount),
              ),
            },
          });
        }
      }

      return updated;
    });
    return this.decryptTransaction(txn);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    return this.prisma.$transaction(async (tx) => {
      if (
        existing.type === TransactionType.TRANSFER &&
        existing.destinationAccountId
      ) {
        const accounts = await tx.account.findMany({
          where: {
            userId,
            id: { in: [existing.accountId, existing.destinationAccountId] },
          },
          select: { id: true, type: true },
        });
        const srcType = accounts.find((a) => a.id === existing.accountId)?.type;
        const dstType = accounts.find(
          (a) => a.id === existing.destinationAccountId,
        )?.type;
        if (srcType && dstType) {
          await tx.account.update({
            where: { id: existing.accountId },
            data: {
              balance: reverseTransferDelta(
                srcType,
                'source',
                Number(existing.amount),
              ),
            },
          });
          await tx.account.update({
            where: { id: existing.destinationAccountId },
            data: {
              balance: reverseTransferDelta(
                dstType,
                'destination',
                Number(existing.amount),
              ),
            },
          });
        }
      }
      return tx.transaction.delete({ where: { id } });
    });
  }

  private decryptTransaction<T extends { notes?: string | null }>(txn: T): T {
    return { ...txn, notes: this.encryption.decryptField(txn.notes) };
  }
}

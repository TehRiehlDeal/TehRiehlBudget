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
 * Returns the signed delta applied to an account's balance by a transaction.
 *
 * Rules:
 *   Asset accounts (CHECKING, SAVINGS, STOCK):
 *     INCOME or transfer-in: +amount
 *     EXPENSE or transfer-out: -amount
 *   Liability accounts (CREDIT, LOAN):
 *     EXPENSE or transfer-out (new charge): +amount  (debt grows)
 *     INCOME or transfer-in (payment/refund): -amount  (debt shrinks)
 */
function signedDelta(
  accountType: AccountType,
  role: 'primary' | 'destination',
  transactionType: TransactionType,
  amount: number,
): number {
  const isLiability = LIABILITY_TYPES.includes(accountType);
  let incomingCash: boolean;
  if (transactionType === TransactionType.INCOME) {
    incomingCash = true;
  } else if (transactionType === TransactionType.EXPENSE) {
    incomingCash = false;
  } else {
    // TRANSFER: destination receives, primary (source) sends
    incomingCash = role === 'destination';
  }
  const positive = isLiability ? !incomingCash : incomingCash;
  return positive ? amount : -amount;
}

function asPrismaUpdate(
  delta: number,
): { increment: number } | { decrement: number } {
  return delta >= 0 ? { increment: delta } : { decrement: -delta };
}

/**
 * Parses a "YYYY-MM-DD" string as noon UTC so the calendar date is preserved
 * across server/client timezone differences. If the input already has a time
 * component, only the date portion is used.
 */
function parseDateInput(dateStr: string): Date {
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
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
      date: parseDateInput(dto.date),
    };
    if (data.notes) {
      data.notes = this.encryption.encryptField(data.notes)!;
    }

    const accountIds = [dto.accountId];
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
      accountIds.push(dto.destinationAccountId);
    } else {
      data.destinationAccountId = null;
    }

    const accounts = await this.prisma.account.findMany({
      where: { userId, id: { in: accountIds } },
      select: { id: true, type: true },
    });
    if (accounts.length !== accountIds.length) {
      throw new NotFoundException('One or more accounts not found');
    }
    const typeById = new Map(accounts.map((a) => [a.id, a.type]));

    const txn = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data,
        include: txnInclude,
      });

      // Apply delta to primary account for all transaction types
      const primaryType = typeById.get(dto.accountId)!;
      await tx.account.update({
        where: { id: dto.accountId },
        data: {
          balance: asPrismaUpdate(
            signedDelta(primaryType, 'primary', dto.type, dto.amount),
          ),
        },
      });

      // For transfers, also update destination
      if (dto.type === TransactionType.TRANSFER && dto.destinationAccountId) {
        const destType = typeById.get(dto.destinationAccountId)!;
        await tx.account.update({
          where: { id: dto.destinationAccountId },
          data: {
            balance: asPrismaUpdate(
              signedDelta(destType, 'destination', dto.type, dto.amount),
            ),
          },
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
    if (dto.date) data.date = parseDateInput(dto.date);
    if (data.notes !== undefined) {
      data.notes = this.encryption.encryptField(data.notes);
    }

    // Determine if anything balance-relevant changed
    const balanceAffected =
      dto.amount !== undefined ||
      dto.accountId !== undefined ||
      dto.destinationAccountId !== undefined ||
      dto.type !== undefined;

    // Collect account IDs we may need types for (old + new)
    const accountIdsNeeded = new Set<string>([existing.accountId]);
    if (existing.destinationAccountId) {
      accountIdsNeeded.add(existing.destinationAccountId);
    }
    if (dto.accountId) accountIdsNeeded.add(dto.accountId);
    if (dto.destinationAccountId) accountIdsNeeded.add(dto.destinationAccountId);

    const accounts = accountIdsNeeded.size
      ? await this.prisma.account.findMany({
          where: { userId, id: { in: Array.from(accountIdsNeeded) } },
          select: { id: true, type: true },
        })
      : [];
    const typeById = new Map(accounts.map((a) => [a.id, a.type]));

    const txn = await this.prisma.$transaction(async (tx) => {
      // Reverse the old transaction's effect on balances
      if (balanceAffected) {
        const oldPrimaryType = typeById.get(existing.accountId);
        if (oldPrimaryType) {
          await tx.account.update({
            where: { id: existing.accountId },
            data: {
              balance: asPrismaUpdate(
                -signedDelta(
                  oldPrimaryType,
                  'primary',
                  existing.type,
                  Number(existing.amount),
                ),
              ),
            },
          });
        }
        if (
          existing.type === TransactionType.TRANSFER &&
          existing.destinationAccountId
        ) {
          const oldDestType = typeById.get(existing.destinationAccountId);
          if (oldDestType) {
            await tx.account.update({
              where: { id: existing.destinationAccountId },
              data: {
                balance: asPrismaUpdate(
                  -signedDelta(
                    oldDestType,
                    'destination',
                    existing.type,
                    Number(existing.amount),
                  ),
                ),
              },
            });
          }
        }
      }

      // Validate transfer constraints on the NEW state
      const newType = (dto.type ?? existing.type) as TransactionType;
      const newAccountId = dto.accountId ?? existing.accountId;
      const newDestId =
        dto.destinationAccountId !== undefined
          ? dto.destinationAccountId
          : existing.destinationAccountId;

      if (newType === TransactionType.TRANSFER) {
        if (!newDestId) {
          throw new BadRequestException(
            'destinationAccountId is required for TRANSFER transactions',
          );
        }
        if (newDestId === newAccountId) {
          throw new BadRequestException(
            'Source and destination accounts must differ',
          );
        }
      } else if (data.destinationAccountId === undefined) {
        // Clear dest if switching away from transfer
        data.destinationAccountId = null;
      }

      const updated = await tx.transaction.update({
        where: { id },
        data,
        include: txnInclude,
      });

      // Apply the new transaction's effect
      if (balanceAffected) {
        const newPrimaryType = typeById.get(updated.accountId);
        if (newPrimaryType) {
          await tx.account.update({
            where: { id: updated.accountId },
            data: {
              balance: asPrismaUpdate(
                signedDelta(
                  newPrimaryType,
                  'primary',
                  updated.type,
                  Number(updated.amount),
                ),
              ),
            },
          });
        }
        if (
          updated.type === TransactionType.TRANSFER &&
          updated.destinationAccountId
        ) {
          const newDestType = typeById.get(updated.destinationAccountId);
          if (newDestType) {
            await tx.account.update({
              where: { id: updated.destinationAccountId },
              data: {
                balance: asPrismaUpdate(
                  signedDelta(
                    newDestType,
                    'destination',
                    updated.type,
                    Number(updated.amount),
                  ),
                ),
              },
            });
          }
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
      const accounts = await tx.account.findMany({
        where: {
          userId,
          id: {
            in: [
              existing.accountId,
              ...(existing.destinationAccountId ? [existing.destinationAccountId] : []),
            ],
          },
        },
        select: { id: true, type: true },
      });
      const typeById = new Map(accounts.map((a) => [a.id, a.type]));

      // Reverse the primary account's effect
      const primaryType = typeById.get(existing.accountId);
      if (primaryType) {
        await tx.account.update({
          where: { id: existing.accountId },
          data: {
            balance: asPrismaUpdate(
              -signedDelta(
                primaryType,
                'primary',
                existing.type,
                Number(existing.amount),
              ),
            ),
          },
        });
      }
      // For transfers, also reverse the destination
      if (
        existing.type === TransactionType.TRANSFER &&
        existing.destinationAccountId
      ) {
        const destType = typeById.get(existing.destinationAccountId);
        if (destType) {
          await tx.account.update({
            where: { id: existing.destinationAccountId },
            data: {
              balance: asPrismaUpdate(
                -signedDelta(
                  destType,
                  'destination',
                  existing.type,
                  Number(existing.amount),
                ),
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

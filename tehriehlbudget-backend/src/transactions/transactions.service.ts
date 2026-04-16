import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionType, Prisma } from '@prisma/client';

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
      // Validate both accounts belong to the user
      const accounts = await this.prisma.account.findMany({
        where: { userId, id: { in: [dto.accountId, dto.destinationAccountId] } },
      });
      if (accounts.length !== 2) {
        throw new NotFoundException('One or both accounts not found');
      }
    } else {
      data.destinationAccountId = null;
    }

    const txn = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data,
        include: txnInclude,
      });
      if (dto.type === TransactionType.TRANSFER && dto.destinationAccountId) {
        await tx.account.update({
          where: { id: dto.accountId },
          data: { balance: { decrement: dto.amount } },
        });
        await tx.account.update({
          where: { id: dto.destinationAccountId },
          data: { balance: { increment: dto.amount } },
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
      // Include transfers where the account is either source or destination
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

    // If transfer-related fields are unchanged, skip balance recalc
    const transferAffected =
      wasTransfer ||
      willBeTransfer ||
      dto.amount !== undefined ||
      dto.accountId !== undefined ||
      dto.destinationAccountId !== undefined;

    const txn = await this.prisma.$transaction(async (tx) => {
      // Reverse the old transfer effect if this was a transfer
      if (wasTransfer && existing.destinationAccountId && transferAffected) {
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: existing.amount } },
        });
        await tx.account.update({
          where: { id: existing.destinationAccountId },
          data: { balance: { decrement: existing.amount } },
        });
      }

      const updated = await tx.transaction.update({
        where: { id },
        data,
        include: txnInclude,
      });

      // Apply the new transfer effect if it will be a transfer
      if (willBeTransfer && updated.destinationAccountId && transferAffected) {
        await tx.account.update({
          where: { id: updated.accountId },
          data: { balance: { decrement: updated.amount } },
        });
        await tx.account.update({
          where: { id: updated.destinationAccountId },
          data: { balance: { increment: updated.amount } },
        });
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
      // Reverse the transfer balance effect on delete
      if (
        existing.type === TransactionType.TRANSFER &&
        existing.destinationAccountId
      ) {
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: existing.amount } },
        });
        await tx.account.update({
          where: { id: existing.destinationAccountId },
          data: { balance: { decrement: existing.amount } },
        });
      }
      return tx.transaction.delete({ where: { id } });
    });
  }

  private decryptTransaction<T extends { notes?: string | null }>(txn: T): T {
    return { ...txn, notes: this.encryption.decryptField(txn.notes) };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionType } from '@prisma/client';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    const data: any = { userId, ...dto, date: new Date(dto.date) };
    if (data.notes) {
      data.notes = this.encryption.encryptField(data.notes)!;
    }
    const txn = await this.prisma.transaction.create({
      data,
      include: { category: true, account: true },
    });
    return this.decryptTransaction(txn);
  }

  async findAll(userId: string, filters: TransactionFilters) {
    const { accountId, categoryId, type, startDate, endDate } = filters;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where: any = { userId };

    if (accountId) where.accountId = accountId;
    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { category: true, account: true },
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
      include: { category: true, account: true },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return this.decryptTransaction(transaction);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    await this.findOne(userId, id);
    const data: any = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    if (data.notes !== undefined) {
      data.notes = this.encryption.encryptField(data.notes);
    }
    const txn = await this.prisma.transaction.update({
      where: { id },
      data,
      include: { category: true, account: true },
    });
    return this.decryptTransaction(txn);
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.transaction.delete({ where: { id } });
  }

  private decryptTransaction<T extends { notes?: string | null }>(txn: T): T {
    return { ...txn, notes: this.encryption.decryptField(txn.notes) };
  }
}

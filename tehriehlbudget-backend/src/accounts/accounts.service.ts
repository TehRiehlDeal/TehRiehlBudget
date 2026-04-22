import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import {
  asPrismaUpdate,
  signedDelta,
} from '../transactions/transactions.service';

@Injectable()
export class AccountsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateAccountDto) {
    const data: any = { userId, ...dto };
    if (data.accountNumber) {
      data.accountNumber = this.encryption.encryptField(data.accountNumber)!;
    }
    // Append new accounts at the end of the sort order
    const max = await this.prisma.account.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    data.sortOrder = (max._max.sortOrder ?? -1) + 1;
    const account = await this.prisma.account.create({ data });
    return this.decryptAccount(account);
  }

  async findAll(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return accounts.map((a) => this.decryptAccount(a));
  }

  async reorder(userId: string, orderedIds: string[]) {
    // Verify all ids belong to this user
    const owned = await this.prisma.account.findMany({
      where: { userId, id: { in: orderedIds } },
      select: { id: true },
    });
    if (owned.length !== orderedIds.length) {
      throw new BadRequestException(
        'One or more account ids do not belong to this user',
      );
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.account.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.findAll(userId);
  }

  async findOne(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return this.decryptAccount(account);
  }

  async update(userId: string, id: string, dto: UpdateAccountDto) {
    await this.findOne(userId, id);
    const data: any = { ...dto };
    if (data.accountNumber !== undefined) {
      data.accountNumber = this.encryption.encryptField(data.accountNumber);
    }
    const account = await this.prisma.account.update({ where: { id }, data });
    return this.decryptAccount(account);
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    // Prisma cascades transaction rows away when the account is deleted, which
    // bypasses TransactionsService.remove() entirely. For transfers, that
    // leaves the surviving counter-party's balance reflecting a transfer
    // that no longer exists. Reverse those counter-party deltas first.
    return this.prisma.$transaction(async (tx) => {
      const related = await tx.transaction.findMany({
        where: {
          userId,
          OR: [{ accountId: id }, { destinationAccountId: id }],
        },
      });

      const counterPartyIds = new Set<string>();
      for (const t of related) {
        if (t.type !== TransactionType.TRANSFER) continue;
        if (t.accountId !== id) counterPartyIds.add(t.accountId);
        if (t.destinationAccountId && t.destinationAccountId !== id) {
          counterPartyIds.add(t.destinationAccountId);
        }
      }

      const counterParties = counterPartyIds.size
        ? await tx.account.findMany({
            where: { userId, id: { in: Array.from(counterPartyIds) } },
            select: { id: true, type: true },
          })
        : [];
      const typeById = new Map(counterParties.map((a) => [a.id, a.type]));

      for (const t of related) {
        if (t.type !== TransactionType.TRANSFER) continue;
        const amount = Number(t.amount);

        if (
          t.accountId === id &&
          t.destinationAccountId &&
          t.destinationAccountId !== id
        ) {
          const cpType = typeById.get(t.destinationAccountId);
          if (cpType) {
            await tx.account.update({
              where: { id: t.destinationAccountId },
              data: {
                balance: asPrismaUpdate(
                  -signedDelta(cpType, 'destination', t.type, amount),
                ),
              },
            });
          }
        } else if (t.destinationAccountId === id && t.accountId !== id) {
          const cpType = typeById.get(t.accountId);
          if (cpType) {
            await tx.account.update({
              where: { id: t.accountId },
              data: {
                balance: asPrismaUpdate(
                  -signedDelta(cpType, 'primary', t.type, amount),
                ),
              },
            });
          }
        }
      }

      return tx.account.delete({ where: { id } });
    });
  }

  private decryptAccount<T extends { accountNumber?: string | null }>(account: T): T {
    return {
      ...account,
      accountNumber: this.encryption.decryptField(account.accountNumber),
    };
  }
}

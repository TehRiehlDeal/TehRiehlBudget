import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

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
    return this.prisma.account.delete({ where: { id } });
  }

  private decryptAccount<T extends { accountNumber?: string | null }>(account: T): T {
    return {
      ...account,
      accountNumber: this.encryption.decryptField(account.accountNumber),
    };
  }
}

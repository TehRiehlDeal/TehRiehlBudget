import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateValuationDto } from './dto/create-valuation.dto';

/**
 * Parses "YYYY-MM-DD" as noon UTC so the calendar date is preserved across
 * timezones (matches the convention in transactions.service.ts).
 */
function parseDateInput(dateStr: string): Date {
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

@Injectable()
export class ValuationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, accountId: string, dto: CreateValuationDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const created = await this.prisma.accountValuation.create({
      data: {
        accountId,
        date: parseDateInput(dto.date),
        value: dto.value,
      },
    });

    await this.recomputeBalance(accountId);
    return created;
  }

  async list(userId: string, accountId: string, days = 365) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.prisma.accountValuation.findMany({
      where: { accountId, date: { gte: cutoff } },
      orderBy: { date: 'asc' },
    });
  }

  async remove(userId: string, valuationId: string) {
    // Scope the lookup through the account relation so strangers can't delete
    const valuation = await this.prisma.accountValuation.findFirst({
      where: { id: valuationId, account: { userId } },
    });
    if (!valuation) {
      throw new NotFoundException('Valuation not found');
    }

    await this.prisma.accountValuation.delete({ where: { id: valuationId } });
    await this.recomputeBalance(valuation.accountId);
    return { success: true };
  }

  private async recomputeBalance(accountId: string) {
    const latest = await this.prisma.accountValuation.findFirst({
      where: { accountId },
      orderBy: { date: 'desc' },
    });
    if (!latest) return;
    await this.prisma.account.update({
      where: { id: accountId },
      data: { balance: Number(latest.value) },
    });
  }
}

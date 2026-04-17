import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType, TransactionType } from '@prisma/client';

function parseDateRange(startDate?: string, endDate?: string) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

const LIABILITY_TYPES: AccountType[] = [AccountType.CREDIT, AccountType.LOAN];

/**
 * Returns the signed delta that a transaction applies to an account's balance,
 * using the same asset/liability sign rules as the transfer logic.
 *
 *   Asset accounts (positive = money you have):
 *     INCOME or transfer-in: +
 *     EXPENSE or transfer-out: -
 *   Liability accounts (positive = debt owed):
 *     EXPENSE or transfer-out (new charge/debt): +
 *     INCOME or transfer-in (payment/refund reducing debt): -
 */
function transactionDelta(
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
    // TRANSFER: destination receives, source sends
    incomingCash = role === 'destination';
  }

  // For assets, incoming cash increases balance.
  // For liabilities, incoming cash (a payment) DECREASES the balance (debt down).
  const positive = isLiability ? !incomingCash : incomingCash;
  return positive ? amount : -amount;
}

@Injectable()
export class AggregationsService {
  constructor(private prisma: PrismaService) {}

  async getNetWorth(userId: string): Promise<number> {
    const [assets, liabilities] = await Promise.all([
      this.prisma.account.aggregate({
        where: {
          userId,
          type: {
            in: ['CHECKING', 'SAVINGS', 'STOCK', 'CASH', 'INVESTMENT', 'RETIREMENT'],
          },
        },
        _sum: { balance: true },
      }),
      this.prisma.account.aggregate({
        where: { userId, type: { in: ['CREDIT', 'LOAN'] } },
        _sum: { balance: true },
      }),
    ]);
    const assetsSum = Number(assets._sum.balance) || 0;
    const liabilitiesSum = Number(liabilities._sum.balance) || 0;
    return assetsSum - liabilitiesSum;
  }

  async getTotalDebt(userId: string): Promise<number> {
    const result = await this.prisma.account.aggregate({
      where: { userId, type: { in: ['CREDIT', 'LOAN'] } },
      _sum: { balance: true },
    });
    return Number(result._sum.balance) || 0;
  }

  async getIncomeVsExpense(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ income: number; expense: number }> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        type: { in: ['INCOME', 'EXPENSE'] },
        date: { gte: parseDateRange(startDate, endDate).start, lte: parseDateRange(startDate, endDate).end },
      },
      _sum: { amount: true },
    });

    const income = Number(groups.find((g) => g.type === 'INCOME')?._sum.amount) || 0;
    const expense = Number(groups.find((g) => g.type === 'EXPENSE')?._sum.amount) || 0;
    return { income, expense };
  }

  async getSpendingByCategory(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ categoryId: string; name: string; color: string; amount: number }[]> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        categoryId: { not: null },
        date: { gte: parseDateRange(startDate, endDate).start, lte: parseDateRange(startDate, endDate).end },
      },
      _sum: { amount: true },
    });

    // Fetch category names for the grouped IDs
    const categoryIds = groups.map((g) => g.categoryId).filter(Boolean) as string[];
    const transactions = await this.prisma.transaction.findMany({
      where: { categoryId: { in: categoryIds } },
      select: { category: { select: { id: true, name: true, color: true } } },
      distinct: ['categoryId'],
    });

    const categoryMap = new Map(
      transactions.map((t) => [t.category!.id, t.category!]),
    );

    return groups.map((g) => {
      const cat = categoryMap.get(g.categoryId!);
      return {
        categoryId: g.categoryId!,
        name: cat?.name || 'Unknown',
        color: cat?.color || '#6b7280',
        amount: Number(g._sum.amount) || 0,
      };
    });
  }

  /**
   * Returns a time series of the account's balance over `days`.
   *
   * For market-value accounts (STOCK, INVESTMENT, RETIREMENT), the series comes
   * directly from logged `AccountValuation` rows — one chart point per snapshot.
   *
   * For transaction-driven accounts (CHECKING, SAVINGS, CASH, CREDIT, LOAN),
   * the series is reconstructed by walking transactions backward from the
   * current stored balance and reversing each delta.
   */
  async getAccountBalanceHistory(
    userId: string,
    accountId: string,
    days = 90,
  ): Promise<{ date: string; balance: number }[]> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true, type: true, balance: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Market-value accounts: plot valuations directly
    if (
      account.type === AccountType.STOCK ||
      account.type === AccountType.INVESTMENT ||
      account.type === AccountType.RETIREMENT
    ) {
      const valuations = await this.prisma.accountValuation.findMany({
        where: { accountId, date: { gte: cutoff } },
        orderBy: { date: 'asc' },
        select: { date: true, value: true },
      });
      return valuations.map((v) => ({
        date: v.date.toISOString().split('T')[0],
        balance: Number(v.value),
      }));
    }

    const currentBalance = Number(account.balance);

    // Pull all transactions affecting this account in the window, ordered newest first
    const txns = await this.prisma.transaction.findMany({
      where: {
        userId,
        OR: [{ accountId }, { destinationAccountId: accountId }],
        date: { gte: cutoff },
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        accountId: true,
        destinationAccountId: true,
        type: true,
        amount: true,
        date: true,
      },
    });

    // Walk from current balance back in time, computing balance-before-each-txn
    const points: { date: string; balance: number }[] = [];
    points.push({
      date: new Date().toISOString().split('T')[0],
      balance: currentBalance,
    });

    let running = currentBalance;
    for (const t of txns) {
      const role: 'primary' | 'destination' =
        t.accountId === accountId ? 'primary' : 'destination';
      const delta = transactionDelta(
        account.type,
        role,
        t.type,
        Number(t.amount),
      );
      // Reverse this transaction's effect to get the balance BEFORE it
      running -= delta;
      points.push({
        date: t.date.toISOString().split('T')[0],
        balance: running,
      });
    }

    // Return oldest first for charting
    return points.reverse();
  }

  async getSummary(userId: string, startDate: string, endDate: string) {
    const [netWorth, totalDebt, incomeVsExpense] = await Promise.all([
      this.getNetWorth(userId),
      this.getTotalDebt(userId),
      this.getIncomeVsExpense(userId, startDate, endDate),
    ]);

    return { netWorth, totalDebt, ...incomeVsExpense };
  }
}

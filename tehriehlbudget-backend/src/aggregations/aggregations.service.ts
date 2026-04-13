import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AggregationsService {
  constructor(private prisma: PrismaService) {}

  async getNetWorth(userId: string): Promise<number> {
    const result = await this.prisma.account.aggregate({
      where: { userId },
      _sum: { balance: true },
    });
    return Number(result._sum.balance) || 0;
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
        date: { gte: new Date(startDate), lte: new Date(endDate) },
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
        date: { gte: new Date(startDate), lte: new Date(endDate) },
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

  async getSummary(userId: string, startDate: string, endDate: string) {
    const [netWorth, totalDebt, incomeVsExpense] = await Promise.all([
      this.getNetWorth(userId),
      this.getTotalDebt(userId),
      this.getIncomeVsExpense(userId, startDate, endDate),
    ]);

    return { netWorth, totalDebt, ...incomeVsExpense };
  }
}

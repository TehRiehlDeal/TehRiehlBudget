import { PrismaClient, AccountType, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a demo user (supabaseId would be set after Supabase Auth is configured)
  const user = await prisma.user.upsert({
    where: { email: 'demo@tehriehlbudget.dev' },
    update: {},
    create: {
      email: 'demo@tehriehlbudget.dev',
      supabaseId: 'demo-supabase-id',
      name: 'Demo User',
    },
  });

  // Create default categories
  const categories = await Promise.all(
    [
      { name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
      { name: 'Dining Out', color: '#FF9800', icon: 'utensils' },
      { name: 'Transportation', color: '#2196F3', icon: 'car' },
      { name: 'Housing', color: '#9C27B0', icon: 'home' },
      { name: 'Utilities', color: '#607D8B', icon: 'zap' },
      { name: 'Entertainment', color: '#E91E63', icon: 'film' },
      { name: 'Healthcare', color: '#F44336', icon: 'heart' },
      { name: 'Income', color: '#8BC34A', icon: 'dollar-sign' },
    ].map((cat) =>
      prisma.category.upsert({
        where: { userId_name: { userId: user.id, name: cat.name } },
        update: {},
        create: { ...cat, userId: user.id },
      }),
    ),
  );

  // Create accounts
  const checking = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Main Checking',
      type: AccountType.CHECKING,
      balance: 5250.0,
      institution: 'BECU',
    },
  });

  const savings = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Emergency Fund',
      type: AccountType.SAVINGS,
      balance: 15000.0,
      institution: 'SoFi',
    },
  });

  const credit = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Discover Card',
      type: AccountType.CREDIT,
      balance: -420.5,
      institution: 'Discover',
    },
  });

  // Create sample transactions
  const incomeCategory = categories.find((c) => c.name === 'Income')!;
  const groceriesCategory = categories.find((c) => c.name === 'Groceries')!;
  const diningCategory = categories.find((c) => c.name === 'Dining Out')!;

  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: checking.id,
        categoryId: incomeCategory.id,
        amount: 3500.0,
        type: TransactionType.INCOME,
        description: 'Paycheck',
        date: new Date('2026-04-01'),
      },
      {
        userId: user.id,
        accountId: checking.id,
        categoryId: groceriesCategory.id,
        amount: 87.43,
        type: TransactionType.EXPENSE,
        description: 'Grocery run',
        date: new Date('2026-04-03'),
      },
      {
        userId: user.id,
        accountId: credit.id,
        categoryId: diningCategory.id,
        amount: 42.0,
        type: TransactionType.EXPENSE,
        description: 'Dinner out',
        date: new Date('2026-04-05'),
      },
    ],
  });

  console.log('Seed data created successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

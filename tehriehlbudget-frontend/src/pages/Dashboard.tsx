import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAggregationsStore } from '@/stores/aggregations';
import { useTransactionsStore } from '@/stores/transactions';
import { useAdvisorStore } from '@/stores/advisor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function formatCurrency(value: number) {
  const abs = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 });
  return value < 0 ? `-$${abs}` : `$${abs}`;
}

export function Dashboard() {
  const { summary, spendingByCategory, fetchSummary, fetchSpendingByCategory } =
    useAggregationsStore();
  const { transactions, fetchTransactions } = useTransactionsStore();
  const { insights, loading: advisorLoading, fetchInsights } = useAdvisorStore();

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, []);

  useEffect(() => {
    fetchSummary(dateRange.startDate, dateRange.endDate);
    fetchSpendingByCategory(dateRange.startDate, dateRange.endDate);
    fetchTransactions({}, 1);
  }, [fetchSummary, fetchSpendingByCategory, fetchTransactions, dateRange]);

  const incomeExpenseData = summary
    ? [
        { name: 'Income', value: summary.income },
        { name: 'Expense', value: summary.expense },
      ]
    : [];

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary ? formatCurrency(summary.netWorth) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Debt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {summary ? formatCurrency(summary.totalDebt) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Income (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {summary ? formatCurrency(summary.income) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expenses (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {summary ? formatCurrency(summary.expense) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Spending by Category - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {spendingByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spending data for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={spendingByCategory}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {spendingByCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Income vs Expense - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expense</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeExpenseData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={incomeExpenseData}>
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]}>
                    {incomeExpenseData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.name === 'Income' ? '#4CAF50' : '#EF4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((txn) => (
                <div key={txn.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{txn.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(txn.date).toLocaleDateString()}
                      {txn.category && ` · ${txn.category.name}`}
                    </p>
                  </div>
                  <Badge variant={txn.type === 'INCOME' ? 'default' : 'secondary'}>
                    {txn.type === 'INCOME' ? '+' : '-'}
                    {formatCurrency(Number(txn.amount))}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Financial Advisor */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            AI Financial Insights
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInsights}
            disabled={advisorLoading}
          >
            {advisorLoading ? 'Analyzing...' : 'Get Advice'}
          </Button>
        </CardHeader>
        <CardContent>
          {insights ? (
            <div className="space-y-2">
              <div className="whitespace-pre-line text-sm leading-relaxed">
                {insights.insights}
              </div>
              <p className="text-xs text-muted-foreground">
                Generated {new Date(insights.generatedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click "Get Advice" to receive AI-powered financial insights based on your spending patterns.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick transaction FAB */}
      <Link
        to="/transactions?new=1"
        aria-label="Quick add transaction"
        className="fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-foreground/10 transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="size-6" />
      </Link>
    </div>
  );
}

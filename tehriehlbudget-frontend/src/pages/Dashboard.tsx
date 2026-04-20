import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAggregationsStore } from '@/stores/aggregations';
import { useTransactionsStore } from '@/stores/transactions';
import { useAdvisorStore } from '@/stores/advisor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, RotateCcw, Send, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/dates';
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
import { ChartTooltip } from '@/components/ChartTooltip';

function formatCurrency(value: number) {
  const abs = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 });
  return value < 0 ? `-$${abs}` : `$${abs}`;
}

type RangeKey = 'this-month' | 'last-30' | 'last-90' | 'ytd';

const RANGE_LABELS: Record<RangeKey, string> = {
  'this-month': 'This month',
  'last-30': 'Last 30 days',
  'last-90': 'Last 90 days',
  ytd: 'Year to date',
};

function computeRange(key: RangeKey): { startDate: string; endDate: string } {
  const now = new Date();
  const toIso = (d: Date) => d.toISOString().split('T')[0];
  let start: Date;
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (key) {
    case 'this-month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last-30':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      break;
    case 'last-90':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
      break;
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return { startDate: toIso(start), endDate: toIso(end) };
}

export function Dashboard() {
  const {
    summary,
    spendingByCategory,
    cashFlow,
    fetchSummary,
    fetchSpendingByCategory,
    fetchCashFlow,
  } = useAggregationsStore();
  const { transactions, fetchTransactions } = useTransactionsStore();
  const {
    messages: advisorMessages,
    loading: advisorLoading,
    startConversation,
    sendMessage,
    resetConversation,
  } = useAdvisorStore();
  const [followUp, setFollowUp] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [advisorMessages]);

  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = followUp.trim();
    if (!trimmed || advisorLoading) return;
    setFollowUp('');
    await sendMessage(trimmed);
  };

  const handleRestart = async () => {
    resetConversation();
    await startConversation();
  };

  const [range, setRange] = useState<RangeKey>('this-month');
  const dateRange = useMemo(() => computeRange(range), [range]);

  useEffect(() => {
    fetchSummary(dateRange.startDate, dateRange.endDate);
    fetchSpendingByCategory(dateRange.startDate, dateRange.endDate);
    fetchCashFlow(dateRange.startDate, dateRange.endDate);
    fetchTransactions({}, 1);
  }, [
    fetchSummary,
    fetchSpendingByCategory,
    fetchCashFlow,
    fetchTransactions,
    dateRange,
  ]);

  const incomeExpenseData = summary
    ? [
        { name: 'Income', value: summary.income },
        { name: 'Expense', value: summary.expense },
      ]
    : [];

  const cashFlowData = cashFlow
    ? [
        { name: 'Inflows', value: cashFlow.inflows },
        { name: 'Outflows', value: cashFlow.outflows },
      ]
    : [];

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <Button
              key={key}
              variant={range === key ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setRange(key)}
            >
              {RANGE_LABELS[key]}
            </Button>
          ))}
        </div>
      </div>

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
              Income ({RANGE_LABELS[range]})
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
              Expenses ({RANGE_LABELS[range]})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {summary ? formatCurrency(summary.expense) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Cash Flow ({RANGE_LABELS[range]})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Net change in liquid accounts (checking, savings, cash) — includes
            credit-card and loan payments as outflows.
          </p>
        </CardHeader>
        <CardContent>
          {!cashFlow ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid grid-cols-3 items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Inflows</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(cashFlow.inflows)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outflows</p>
                  <p className="text-xl font-bold text-destructive">
                    {formatCurrency(cashFlow.outflows)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net remaining</p>
                  <p
                    className={`text-xl font-bold ${
                      cashFlow.net >= 0 ? 'text-green-600' : 'text-destructive'
                    }`}
                  >
                    {formatCurrency(cashFlow.net)}
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={cashFlowData}>
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {cashFlowData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.name === 'Inflows' ? '#4CAF50' : '#EF4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

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
                  <Tooltip content={<ChartTooltip />} />
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
                  <Tooltip content={<ChartTooltip />} />
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
                      {formatDate(txn.date)}
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
            AI Financial Buddy
          </CardTitle>
          {advisorMessages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestart}
              disabled={advisorLoading}
              aria-label="Restart conversation"
              title="Restart conversation"
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {advisorMessages.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                Get a conversational read on how your month is going, then ask
                follow-up questions for deeper guidance.
              </p>
              <Button onClick={startConversation} disabled={advisorLoading}>
                <Sparkles className="mr-1 size-4" />
                {advisorLoading ? 'Analyzing...' : 'Get Advice'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                ref={chatScrollRef}
                className="max-h-[50vh] space-y-3 overflow-y-auto pr-2"
              >
                {advisorMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      m.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-primary/10 text-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {advisorLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleSendFollowUp} className="flex gap-2">
                <Input
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  placeholder="Ask a follow-up..."
                  disabled={advisorLoading}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!followUp.trim() || advisorLoading}
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
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

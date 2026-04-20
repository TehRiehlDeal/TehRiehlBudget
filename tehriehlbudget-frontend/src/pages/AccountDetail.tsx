import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useTransactionsStore, type Transaction } from '@/stores/transactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Pencil,
  Trash2,
} from 'lucide-react';
import { TransactionForm } from '@/components/TransactionForm';
import { ReceiptViewer } from '@/components/ReceiptViewer';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDate, todayInputValue } from '@/lib/dates';
import { isMarketValue } from '@/lib/accountTypes';
import { Plus } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function formatCurrency(value: number) {
  const abs = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 });
  return value < 0 ? `-$${abs}` : `$${abs}`;
}

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accounts, fetchAccounts } = useAccountsStore();
  const { categories, fetchCategories } = useCategoriesStore();
  const {
    transactions,
    total,
    page,
    loading,
    fetchTransactions,
    updateTransaction,
    deleteTransaction,
  } = useTransactionsStore();

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [history, setHistory] = useState<{ date: string; balance: number }[]>([]);
  const [historyDays, setHistoryDays] = useState(90);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [valuations, setValuations] = useState<
    { id: string; date: string; value: number }[]
  >([]);
  const [valuationDialogOpen, setValuationDialogOpen] = useState(false);
  const [valuationDate, setValuationDate] = useState(todayInputValue());
  const [valuationAmount, setValuationAmount] = useState('');
  const [valuationRefresh, setValuationRefresh] = useState(0);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  useEffect(() => {
    if (id) fetchTransactions({ accountId: id }, 1);
  }, [id, fetchTransactions]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setHistoryLoading(true);
    api
      .get<{ date: string; balance: number }[]>(
        `/aggregations/account-balance-history/${id}?days=${historyDays}`,
      )
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load balance history', err);
          setHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, historyDays, valuationRefresh]);

  const account = useMemo(
    () => accounts.find((a) => a.id === id),
    [accounts, id],
  );

  const showValuations = account ? isMarketValue(account.type) : false;

  useEffect(() => {
    if (!id || !showValuations) {
      setValuations([]);
      return;
    }
    let cancelled = false;
    api
      .get<{ id: string; date: string; value: number }[]>(
        `/accounts/${id}/valuations?days=365`,
      )
      .then((data) => {
        if (!cancelled) setValuations(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load valuations', err);
          setValuations([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, showValuations, valuationRefresh]);

  const handleUpdate = async (data: any) => {
    if (!editing) return;
    await updateTransaction(editing.id, data);
    setEditing(null);
    if (id) fetchTransactions({ accountId: id }, page);
  };

  const handleCreateValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !valuationAmount) return;
    await api.post(`/accounts/${id}/valuations`, {
      date: valuationDate,
      value: parseFloat(valuationAmount),
    });
    setValuationDialogOpen(false);
    setValuationAmount('');
    setValuationDate(todayInputValue());
    await fetchAccounts();
    setValuationRefresh((n) => n + 1);
  };

  const handleDeleteValuation = async (valuationId: string) => {
    if (!id) return;
    await api.delete(`/accounts/${id}/valuations/${valuationId}`);
    await fetchAccounts();
    setValuationRefresh((n) => n + 1);
  };

  const totalPages = Math.ceil(total / 20);

  if (!id) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/accounts')}>
          <ArrowLeft className="mr-1 size-4" /> Back
        </Button>
      </div>

      {account ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl">{account.name}</CardTitle>
              {account.institution && (
                <p className="text-sm text-muted-foreground">{account.institution}</p>
              )}
            </div>
            <Badge variant="secondary">{account.type}</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(Number(account.balance))}
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Loading account...</p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Balance over time</CardTitle>
          <div className="flex items-center gap-2">
            {showValuations && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setValuationDialogOpen(true)}
              >
                <Plus className="mr-1 size-3.5" /> Log value
              </Button>
            )}
            <div className="flex gap-1">
              {[30, 90, 180, 365].map((d) => (
                <Button
                  key={d}
                  variant={historyDays === d ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setHistoryDays(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading && history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading chart...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No balance changes in this window.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => {
                    // Parse YYYY-MM-DD as local components to avoid UTC
                    // midnight being rendered as the previous day in
                    // timezones west of UTC.
                    const [, m, d] = v.slice(0, 10).split('-').map(Number);
                    return `${m}/${d}`;
                  }}
                  fontSize={11}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
                  fontSize={11}
                  width={70}
                />
                <Tooltip
                  formatter={(value: any) => formatCurrency(Number(value))}
                  labelFormatter={(label) =>
                    typeof label === 'string' ? formatDate(label) : String(label ?? '')
                  }
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {showValuations && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Valuations</CardTitle>
          </CardHeader>
          <CardContent>
            {valuations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No valuations logged yet. Click "Log value" to record today's total.
              </p>
            ) : (
              <div className="space-y-1">
                {[...valuations].reverse().map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span className="text-muted-foreground">{formatDate(v.date)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(Number(v.value))}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteValuation(v.id)}
                        aria-label="Delete valuation"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Transactions</h2>
        <Link to="/transactions">
          <Button variant="outline" size="sm">View all</Button>
        </Link>
      </div>

      {loading && transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No transactions for this account yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm">{formatDate(txn.date)}</TableCell>
                    <TableCell className="text-sm font-medium">{txn.description}</TableCell>
                    <TableCell>
                      {txn.category && (
                        <div className="flex items-center gap-1.5">
                          <div className="size-2.5 rounded-full" style={{ backgroundColor: txn.category.color || '#6b7280' }} />
                          <span className="text-sm">{txn.category.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {txn.type === 'TRANSFER' && txn.destinationAccount ? (
                        <span className="inline-flex items-center gap-1">
                          {txn.account?.name}
                          <ArrowRight className="size-3 text-muted-foreground" />
                          {txn.destinationAccount.name}
                        </span>
                      ) : (
                        txn.account?.name
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(Number(txn.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={txn.type === 'INCOME' ? 'default' : 'secondary'}>
                        {txn.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {txn.receiptPath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingReceipt(txn.receiptPath!)}
                          aria-label="View receipt"
                          title="View receipt"
                        >
                          <Paperclip className="size-3.5" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(txn)} aria-label="Edit transaction">
                          <Pencil className="size-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteTransaction(txn.id)} aria-label="Delete transaction">
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => fetchTransactions({ accountId: id }, page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => fetchTransactions({ accountId: id }, page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          {editing && (
            <TransactionForm
              initial={editing}
              accounts={accounts}
              categories={categories}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={valuationDialogOpen} onOpenChange={setValuationDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log account value</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateValuation} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input
                type="date"
                value={valuationDate}
                onChange={(e) => setValuationDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Total value</label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 52340.00"
                value={valuationAmount}
                onChange={(e) => setValuationAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setValuationDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!valuationAmount}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ReceiptViewer
        receiptPath={viewingReceipt}
        onClose={() => setViewingReceipt(null)}
      />
    </div>
  );
}

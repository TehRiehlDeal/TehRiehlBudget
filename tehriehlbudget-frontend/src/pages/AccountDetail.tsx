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

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  useEffect(() => {
    if (id) fetchTransactions({ accountId: id }, 1);
  }, [id, fetchTransactions]);

  const handleUpdate = async (data: any) => {
    if (!editing) return;
    await updateTransaction(editing.id, data);
    setEditing(null);
    if (id) fetchTransactions({ accountId: id }, page);
  };

  const account = useMemo(
    () => accounts.find((a) => a.id === id),
    [accounts, id],
  );

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
                    <TableCell className="text-sm">{new Date(txn.date).toLocaleDateString()}</TableCell>
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

      <ReceiptViewer
        receiptPath={viewingReceipt}
        onClose={() => setViewingReceipt(null)}
      />
    </div>
  );
}

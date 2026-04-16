import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useTransactionsStore,
  type Transaction,
  type TransactionFilters,
} from '@/stores/transactions';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Paperclip,
  Pencil,
  ArrowRight,
} from 'lucide-react';
import { TransactionForm } from '@/components/TransactionForm';
import { ReceiptViewer } from '@/components/ReceiptViewer';

const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;

export function Transactions() {
  const {
    transactions,
    total,
    page,
    loading,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactionsStore();
  const { accounts, fetchAccounts } = useAccountsStore();
  const { categories, fetchCategories } = useCategoriesStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
    fetchTransactions(filters, 1);
  }, [fetchAccounts, fetchCategories, fetchTransactions, filters]);

  const totalPages = Math.ceil(total / 20);

  const accountName = (id: string | null | undefined) =>
    id ? accounts.find((a) => a.id === id)?.name ?? '' : '';
  const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

  const handleCreate = async (data: any) => {
    await createTransaction(data);
    setCreateOpen(false);
    fetchTransactions(filters, page);
  };

  const handleUpdate = async (data: any) => {
    if (!editing) return;
    await updateTransaction(editing.id, data);
    setEditing(null);
    fetchTransactions(filters, page);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 size-4" /> Add Transaction
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
            <TransactionForm
              accounts={accounts}
              categories={categories}
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select
          value={filters.accountId || 'all'}
          onValueChange={(v) => setFilters((f) => ({ ...f, accountId: v === 'all' || v === null ? undefined : v }))}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All accounts">
              {(v: any) => (v === 'all' ? 'All accounts' : accountName(v) || 'All accounts')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.type || 'all'}
          onValueChange={(v) => setFilters((f) => ({ ...f, type: v === 'all' || v === null ? undefined : v }))}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All types">
              {(v: any) => (v === 'all' ? 'All types' : typeLabel(String(v)))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TRANSACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading && transactions.length === 0 ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-muted-foreground">No transactions found.</p>
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
                      ${Number(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                onClick={() => fetchTransactions(filters, page - 1)}
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
                onClick={() => fetchTransactions(filters, page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit dialog */}
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

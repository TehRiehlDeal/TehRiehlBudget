import { useEffect, useState } from 'react';
import { useTransactionsStore, type TransactionFilters } from '@/stores/transactions';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, ChevronLeft, ChevronRight, Trash2, Paperclip, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;

export function Transactions() {
  const {
    transactions,
    total,
    page,
    loading,
    fetchTransactions,
    createTransaction,
    deleteTransaction,
  } = useTransactionsStore();
  const { accounts, fetchAccounts } = useAccountsStore();
  const { categories, fetchCategories } = useCategoriesStore();

  const [filters, setFilters] = useState<TransactionFilters>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [accountId, setAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<string>('EXPENSE');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const isTransfer = type === 'TRANSFER';

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
    fetchTransactions(filters, 1);
  }, [fetchAccounts, fetchCategories, fetchTransactions, filters]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    let receiptPath: string | undefined;
    if (receiptFile) {
      const formData = new FormData();
      formData.append('file', receiptFile);
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (res.ok) {
        const { path } = await res.json();
        receiptPath = path;
      }
    }

    await createTransaction({
      accountId,
      destinationAccountId: isTransfer ? destinationAccountId : undefined,
      categoryId: isTransfer ? undefined : categoryId || undefined,
      amount: parseFloat(amount),
      type: type as any,
      description,
      notes: notes || undefined,
      date,
      receiptPath,
    });
    setDialogOpen(false);
    resetForm();
    fetchTransactions(filters, page);
  };

  const resetForm = () => {
    setAccountId('');
    setDestinationAccountId('');
    setCategoryId('');
    setAmount('');
    setType('EXPENSE');
    setDescription('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    setReceiptFile(null);
  };

  const totalPages = Math.ceil(total / 20);

  const accountName = (id: string | null | undefined) =>
    id ? accounts.find((a) => a.id === id)?.name ?? '' : '';
  const categoryName = (id: string | null | undefined) =>
    id ? categories.find((c) => c.id === id)?.name ?? '' : '';
  const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 size-4" /> Add Transaction
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <Select value={type} onValueChange={(v) => setType(v ?? 'EXPENSE')}>
                <SelectTrigger>
                  <SelectValue>{(v: any) => typeLabel(String(v ?? 'EXPENSE'))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                {isTransfer && <label className="text-xs text-muted-foreground">From account</label>}
                <Select value={accountId} onValueChange={(v) => setAccountId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder={isTransfer ? 'From account' : 'Select account'}>
                      {(v: any) => accountName(v) || (isTransfer ? 'From account' : 'Select account')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isTransfer && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">To account</label>
                  <Select value={destinationAccountId} onValueChange={(v) => setDestinationAccountId(v ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="To account">
                        {(v: any) => accountName(v) || 'To account'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.id !== accountId)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Input type="number" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
              {!isTransfer && (
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category (optional)">
                      {(v: any) => categoryName(v) || 'Category (optional)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="space-y-1">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                  <Paperclip className="size-4 text-muted-foreground" />
                  <span>{receiptFile ? 'Change receipt' : 'Attach receipt'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {receiptFile && (
                  <p className="truncate text-xs text-muted-foreground" title={receiptFile.name}>
                    {receiptFile.name}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!accountId || (isTransfer && !destinationAccountId)}>
                  Create
                </Button>
              </div>
            </form>
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
                      <Paperclip className="size-3.5 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => deleteTransaction(txn.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

          {/* Pagination */}
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
    </div>
  );
}

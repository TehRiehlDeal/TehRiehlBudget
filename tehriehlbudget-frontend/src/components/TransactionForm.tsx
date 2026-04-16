import { useState } from 'react';
import type { Account } from '@/stores/accounts';
import type { Category } from '@/stores/categories';
import type { Transaction } from '@/stores/transactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Paperclip } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toDateInputValue } from '@/lib/dates';

function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;

type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface TransactionFormData {
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
  amount: number;
  type: TransactionType;
  description: string;
  notes?: string;
  date: string;
  receiptPath?: string;
}

interface Props {
  initial?: Transaction;
  accounts: Account[];
  categories: Category[];
  submitLabel?: string;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
}

export function TransactionForm({
  initial,
  accounts,
  categories,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [destinationAccountId, setDestinationAccountId] = useState(
    initial?.destinationAccountId ?? '',
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [type, setType] = useState<TransactionType>(
    (initial?.type as TransactionType) ?? 'EXPENSE',
  );
  const [description, setDescription] = useState(initial?.description ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [date, setDate] = useState(
    initial?.date ? toDateInputValue(initial.date) : todayInputValue(),
  );
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isTransfer = type === 'TRANSFER';

  const accountName = (id: string | null | undefined) =>
    id ? accounts.find((a) => a.id === id)?.name ?? '' : '';
  const categoryName = (id: string | null | undefined) =>
    id ? categories.find((c) => c.id === id)?.name ?? '' : '';
  const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // If a new file was chosen, upload it and use the returned path.
      // Otherwise keep the existing receiptPath from `initial`.
      let receiptPath: string | undefined = initial?.receiptPath ?? undefined;
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

      await onSubmit({
        accountId,
        destinationAccountId: isTransfer ? destinationAccountId : undefined,
        categoryId: isTransfer ? undefined : categoryId || undefined,
        amount: parseFloat(amount),
        type,
        description,
        notes: notes || undefined,
        date,
        receiptPath,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(accountId) && (!isTransfer || Boolean(destinationAccountId));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select value={type} onValueChange={(v) => setType((v ?? 'EXPENSE') as TransactionType)}>
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

      <Input
        type="number"
        step="0.01"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <Input
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

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

      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      <Input
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="space-y-1">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
          <Paperclip className="size-4 text-muted-foreground" />
          <span>
            {receiptFile
              ? 'Change receipt'
              : initial?.receiptPath
                ? 'Replace receipt'
                : 'Attach receipt'}
          </span>
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
        {!receiptFile && initial?.receiptPath && (
          <p className="truncate text-xs text-muted-foreground">
            Current: {initial.receiptPath.split('/').pop()}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? 'Saving...' : (submitLabel ?? (initial ? 'Save' : 'Create'))}
        </Button>
      </div>
    </form>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useTransactionsStore,
  type Transaction,
  type TransactionFilters,
} from '@/stores/transactions';
import { encodeCsv, downloadCsv } from '@/lib/csv';
import { todayInputValue, formatDate } from '@/lib/dates';

type Preset = '30d' | '60d' | '90d' | 'ytd' | 'all' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '60d', label: 'Last 60 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' },
  { value: 'all', label: 'All time' },
];

function shiftDays(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Preset, today: string): { start: string; end: string } {
  switch (preset) {
    case '30d':
      return { start: shiftDays(today, 30), end: today };
    case '60d':
      return { start: shiftDays(today, 60), end: today };
    case '90d':
      return { start: shiftDays(today, 90), end: today };
    case 'ytd': {
      const year = today.slice(0, 4);
      return { start: `${year}-01-01`, end: today };
    }
    case 'all':
      return { start: '', end: '' };
    default:
      return { start: '', end: '' };
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'all';
}

function rowsForCsv(transactions: Transaction[]): string[][] {
  const header = [
    'Date',
    'Description',
    'Category',
    'Account',
    'Destination Account',
    'Amount',
    'Type',
    'Notes',
  ];
  const data = transactions.map((t) => [
    formatDate(t.date),
    t.description ?? '',
    t.category?.name ?? '',
    t.account?.name ?? '',
    t.destinationAccount?.name ?? '',
    Number(t.amount).toFixed(2),
    t.type,
    t.notes ?? '',
  ]);
  return [header, ...data];
}

export interface ExportTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseFilters: TransactionFilters;
  accountName?: string;
}

export function ExportTransactionsDialog({
  open,
  onOpenChange,
  baseFilters,
  accountName,
}: ExportTransactionsDialogProps) {
  const today = useMemo(() => todayInputValue(), []);
  const [preset, setPreset] = useState<Preset>('30d');
  const [startDate, setStartDate] = useState(() => rangeForPreset('30d', today).start);
  const [endDate, setEndDate] = useState(() => rangeForPreset('30d', today).end);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to default preset whenever the dialog opens
  useEffect(() => {
    if (open) {
      const next = rangeForPreset('30d', today);
      setPreset('30d');
      setStartDate(next.start);
      setEndDate(next.end);
      setError(null);
    }
  }, [open, today]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    const r = rangeForPreset(p, today);
    setStartDate(r.start);
    setEndDate(r.end);
  };

  const handleExport = async () => {
    setPending(true);
    setError(null);
    try {
      const filters: TransactionFilters = { ...baseFilters };
      if (preset !== 'all') {
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
      }
      const transactions = await useTransactionsStore
        .getState()
        .fetchAllTransactions(filters);
      const csv = encodeCsv(rowsForCsv(transactions));
      const namePart = accountName ? `-${slugify(accountName)}` : '';
      downloadCsv(`transactions${namePart}-${today}.csv`, csv);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export transactions</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Date range</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={preset === p.value ? 'default' : 'outline'}
                  onClick={() => choosePreset(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Start</span>
              <Input
                type="date"
                value={startDate}
                disabled={preset === 'all'}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('custom');
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">End</span>
              <Input
                type="date"
                value={endDate}
                disabled={preset === 'all'}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset('custom');
                }}
              />
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={pending}>
            {pending ? 'Exporting…' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

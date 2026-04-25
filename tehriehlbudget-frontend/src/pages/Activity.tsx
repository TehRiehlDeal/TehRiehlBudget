import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useActivityStore,
  type ActivityFilters,
  type ActivityLogEntry,
  type EntityType,
  type ActivityAction,
} from '@/stores/activity';
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
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { formatDate } from '@/lib/dates';

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: 'TRANSACTION', label: 'Transaction' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'ACCOUNT_VALUATION', label: 'Valuation' },
];

const ACTIONS: { value: ActivityAction; label: string }[] = [
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
];

function actionBadgeVariant(
  action: ActivityAction,
): 'default' | 'secondary' | 'destructive' {
  if (action === 'CREATE') return 'default';
  if (action === 'DELETE') return 'destructive';
  return 'secondary';
}

function entityLabel(type: EntityType): string {
  return ENTITY_TYPES.find((e) => e.value === type)?.label ?? type;
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-$${abs}` : `$${abs}`;
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function ActivityDetail({
  entry,
  resolveAccount,
  resolveCategory,
}: {
  entry: ActivityLogEntry;
  resolveAccount: (id: string | null | undefined) => string;
  resolveCategory: (id: string | null | undefined) => string;
}) {
  const snap = (entry.snapshot ?? {}) as Record<string, unknown>;

  if (!entry.snapshot) {
    return (
      <p className="text-sm text-muted-foreground">No additional details recorded.</p>
    );
  }

  if (entry.entityType === 'TRANSACTION') {
    const type = String(snap.type ?? '');
    const amount = Number(snap.amount ?? 0);
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DetailField label="Date" value={snap.date ? formatDate(String(snap.date)) : '—'} />
        <DetailField label="Type" value={type ? titleCase(type) : '—'} />
        <DetailField label="Amount" value={formatCurrency(amount)} />
        <DetailField
          label="Description"
          value={(snap.description as string) || '—'}
        />
        <DetailField label="Account" value={resolveAccount(snap.accountId as string)} />
        {snap.destinationAccountId ? (
          <DetailField
            label="Destination Account"
            value={resolveAccount(snap.destinationAccountId as string)}
          />
        ) : null}
        {snap.categoryId ? (
          <DetailField label="Category" value={resolveCategory(snap.categoryId as string)} />
        ) : null}
      </div>
    );
  }

  if (entry.entityType === 'ACCOUNT') {
    const balance = Number(snap.balance ?? 0);
    const type = String(snap.type ?? '');
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DetailField label="Name" value={(snap.name as string) || '—'} />
        <DetailField label="Type" value={type ? titleCase(type) : '—'} />
        <DetailField label="Balance" value={formatCurrency(balance)} />
        {snap.institution ? (
          <DetailField label="Institution" value={snap.institution as string} />
        ) : null}
      </div>
    );
  }

  if (entry.entityType === 'ACCOUNT_VALUATION') {
    const value = Number(snap.value ?? 0);
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DetailField label="Date" value={snap.date ? formatDate(String(snap.date)) : '—'} />
        <DetailField label="Value" value={formatCurrency(value)} />
        <DetailField label="Account" value={resolveAccount(snap.accountId as string)} />
      </div>
    );
  }

  return null;
}

export function Activity() {
  const { activities, total, page, loading, fetchActivities } =
    useActivityStore();
  const { accounts, fetchAccounts } = useAccountsStore();
  const { categories, fetchCategories } = useCategoriesStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<ActivityFilters>(() => {
    const accountId = searchParams.get('accountId');
    return accountId ? { accountId } : {};
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  // Strip the deeplink param after we've seeded state — same pattern as Transactions.tsx
  useEffect(() => {
    if (searchParams.get('accountId')) {
      searchParams.delete('accountId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  useEffect(() => {
    fetchActivities(filters, 1);
  }, [fetchActivities, filters]);

  const totalPages = Math.ceil(total / 20);

  const accountName = (id: string | null | undefined) =>
    id ? accounts.find((a) => a.id === id)?.name ?? '(Deleted account)' : '—';
  const categoryName = (id: string | null | undefined) =>
    id ? categories.find((c) => c.id === id)?.name ?? '(Deleted category)' : '—';

  const summarize = (entry: ActivityLogEntry): string => {
    if (entry.summary) return entry.summary;
    return `${entityLabel(entry.entityType)} ${entry.entityId.slice(0, 8)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">History</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select
          value={filters.entityType ?? 'all'}
          onValueChange={(v) =>
            setFilters((f) => ({
              ...f,
              entityType: v === 'all' ? undefined : (v as EntityType),
            }))
          }
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All entities">
              {(v: any) =>
                v === 'all' || !v ? 'All entities' : entityLabel(v as EntityType)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {ENTITY_TYPES.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.action ?? 'all'}
          onValueChange={(v) =>
            setFilters((f) => ({
              ...f,
              action: v === 'all' ? undefined : (v as ActivityAction),
            }))
          }
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All actions">
              {(v: any) => {
                if (v === 'all' || !v) return 'All actions';
                return (
                  ACTIONS.find((a) => a.value === v)?.label ?? String(v)
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.accountId ?? 'all'}
          onValueChange={(v) =>
            setFilters((f) => ({
              ...f,
              accountId: v === 'all' ? undefined : v,
            }))
          }
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All accounts">
              {(v: any) =>
                v === 'all' || !v
                  ? 'All accounts'
                  : accounts.find((a) => a.id === v)?.name ?? 'All accounts'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          aria-label="Start date"
          className="w-full sm:w-[160px]"
          value={filters.startDate ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))
          }
        />
        <Input
          type="date"
          aria-label="End date"
          className="w-full sm:w-[160px]"
          value={filters.endDate ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))
          }
        />
      </div>

      {loading && activities.length === 0 ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : activities.length === 0 ? (
        <p className="text-muted-foreground">No activity yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((entry) => {
                  const isOpen = expanded === entry.id;
                  return (
                    <Fragment key={entry.id}>
                      <TableRow
                        onClick={() => setExpanded(isOpen ? null : entry.id)}
                        className="cursor-pointer"
                      >
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionBadgeVariant(entry.action)}>
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entityLabel(entry.entityType)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {summarize(entry)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.accountId ? accountName(entry.accountId) : ''}
                          {entry.destinationAccountId && (
                            <>
                              {' → '}
                              {accountName(entry.destinationAccountId)}
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          <ChevronDown
                            className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="px-2 py-3">
                              <ActivityDetail
                                entry={entry}
                                resolveAccount={accountName}
                                resolveCategory={categoryName}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => fetchActivities(filters, page - 1)}
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
                onClick={() => fetchActivities(filters, page + 1)}
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

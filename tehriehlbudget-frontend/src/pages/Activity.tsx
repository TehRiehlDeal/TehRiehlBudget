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

export function Activity() {
  const { activities, total, page, loading, fetchActivities } =
    useActivityStore();
  const { accounts, fetchAccounts } = useAccountsStore();
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
  }, [fetchAccounts]);

  useEffect(() => {
    fetchActivities(filters, 1);
  }, [fetchActivities, filters]);

  const totalPages = Math.ceil(total / 20);

  const accountName = (id: string | null | undefined) =>
    id ? accounts.find((a) => a.id === id)?.name ?? '(Deleted account)' : '';

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
                            <pre className="overflow-x-auto rounded p-3 text-xs">
                              {entry.snapshot
                                ? JSON.stringify(entry.snapshot, null, 2)
                                : '(no snapshot)'}
                            </pre>
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

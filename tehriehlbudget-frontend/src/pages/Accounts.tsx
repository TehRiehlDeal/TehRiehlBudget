import { useEffect, useState } from 'react';
import { useAccountsStore, type Account } from '@/stores/accounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'CREDIT', 'LOAN', 'STOCK'] as const;

function AccountForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Account>;
  onSubmit: (data: Partial<Account>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'CHECKING');
  const [balance, setBalance] = useState(String(initial?.balance ?? '0'));
  const [institution, setInstitution] = useState(initial?.institution || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ name, type, balance: parseFloat(balance), institution: institution || undefined });
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Select value={type} onValueChange={(v) => setType(v as Account['type'])}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {ACCOUNT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input type="number" step="0.01" placeholder="Balance" value={balance} onChange={(e) => setBalance(e.target.value)} />
      <Input placeholder="Institution (optional)" value={institution} onChange={(e) => setInstitution(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{initial ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

export function Accounts() {
  const { accounts, loading, fetchAccounts, createAccount, updateAccount, deleteAccount } = useAccountsStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async (data: Partial<Account>) => {
    await createAccount(data);
    setDialogOpen(false);
  };

  const handleUpdate = async (data: Partial<Account>) => {
    if (editing) {
      await updateAccount(editing.id, data);
      setEditing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 size-4" /> Add Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
            <AccountForm onSubmit={handleCreate} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {loading && accounts.length === 0 ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="text-muted-foreground">No accounts yet. Add one to get started.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                <Badge variant="secondary">{account.type}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ${Number(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                {account.institution && (
                  <p className="text-xs text-muted-foreground">{account.institution}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(account)}
                  >
                    <Pencil className="mr-1 size-3" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAccount(account.id)}
                  >
                    <Trash2 className="mr-1 size-3" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {editing && (
            <AccountForm
              initial={editing}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Landmark, RefreshCw, Trash2 } from 'lucide-react';

interface PlaidItem {
  id: string;
  institutionName: string;
  status: string;
  lastSync: string | null;
  plaidAccounts: { id: string; account: { name: string; type: string; balance: number } }[];
}

export function PlaidConnect() {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    const data = await api.get<PlaidItem[]>('/plaid/items');
    setItems(data);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getLinkToken = async () => {
    const { linkToken } = await api.post<{ linkToken: string }>('/plaid/link-token', {});
    setLinkToken(linkToken);
  };

  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      setLoading(true);
      await api.post('/plaid/exchange-token', { publicToken, metadata });
      setLinkToken(null);
      await fetchItems();
      setLoading(false);
    },
    [fetchItems],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const handleSync = async (itemId: string) => {
    setLoading(true);
    await api.post(`/plaid/sync/${itemId}`, {});
    await fetchItems();
    setLoading(false);
  };

  const handleRemove = async (itemId: string) => {
    await api.delete(`/plaid/items/${itemId}`);
    await fetchItems();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Connected Banks</h1>
        <Button onClick={getLinkToken} disabled={loading}>
          <Landmark className="mr-2 size-4" /> Connect Bank
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">
          No banks connected yet. Click "Connect Bank" to link your financial institution via Plaid.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">
                  <Landmark className="mr-2 inline size-4" />
                  {item.institutionName || 'Unknown Institution'}
                </CardTitle>
                <Badge variant={item.status === 'connected' ? 'default' : 'secondary'}>
                  {item.status}
                </Badge>
              </CardHeader>
              <CardContent>
                {item.plaidAccounts.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {item.plaidAccounts.map((pa) => (
                      <div key={pa.id} className="flex justify-between text-sm">
                        <span>{pa.account.name}</span>
                        <span className="font-medium">
                          ${Number(pa.account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {item.lastSync && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    Last synced: {new Date(item.lastSync).toLocaleString()}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleSync(item.id)} disabled={loading}>
                    <RefreshCw className="mr-1 size-3" /> Sync
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(item.id)}>
                    <Trash2 className="mr-1 size-3" /> Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

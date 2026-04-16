import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  receiptPath: string | null;
  onClose: () => void;
}

function parseReceiptPath(receiptPath: string) {
  const parts = receiptPath.split('/');
  return {
    userId: parts[1] ?? '',
    filename: parts[parts.length - 1] ?? '',
  };
}

export function ReceiptViewer({ receiptPath, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');

  useEffect(() => {
    if (!receiptPath) {
      setBlobUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { userId, filename } = parseReceiptPath(receiptPath);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;

        const res = await fetch(`${apiUrl}/files/${userId}/${filename}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Failed to load receipt (${res.status})`);
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
        setMimeType(blob.type);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [receiptPath]);

  const filename = receiptPath ? receiptPath.split('/').pop() ?? 'receipt' : 'receipt';
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenInTab = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={!!receiptPath} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{filename}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {blobUrl && !error && (
            <div className="overflow-hidden rounded-md border">
              {isImage ? (
                <img src={blobUrl} alt={filename} className="max-h-[70vh] w-full object-contain" />
              ) : isPdf ? (
                <iframe src={blobUrl} title={filename} className="h-[70vh] w-full" />
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  Preview not available for this file type. Use Download below.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenInTab} disabled={!blobUrl}>
              <ExternalLink className="mr-1 size-4" /> Open in new tab
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!blobUrl}>
              <Download className="mr-1 size-4" /> Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

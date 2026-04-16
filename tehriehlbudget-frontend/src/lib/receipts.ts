import { supabase } from './supabase';

/**
 * Fetches a receipt file with the current auth token and opens it in a new tab.
 * receiptPath is stored as "receipts/{userId}/{filename}".
 */
export async function openReceipt(receiptPath: string) {
  const parts = receiptPath.split('/');
  if (parts.length < 3) {
    console.error('Invalid receipt path:', receiptPath);
    return;
  }
  const userId = parts[1];
  const filename = parts[parts.length - 1];

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;

  const res = await fetch(`${apiUrl}/files/${userId}/${filename}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    console.error('Failed to load receipt:', res.statusText);
    return;
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener');
  // Let the browser hold on to the URL until the tab is closed;
  // revoke after a delay to release memory.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

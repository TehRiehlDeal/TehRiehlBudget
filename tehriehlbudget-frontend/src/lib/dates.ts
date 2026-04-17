/**
 * Formats a date value (string from the API or a Date) for display as a local
 * calendar date, independent of the stored time-of-day. This avoids the common
 * off-by-one bug where midnight-UTC dates render as the previous day in
 * timezones west of UTC.
 */
export function formatDate(input: string | Date): string {
  const iso =
    typeof input === 'string' ? input : input.toISOString();
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString();
}

/**
 * Normalizes a date value to a `YYYY-MM-DD` string suitable for a date input.
 */
export function toDateInputValue(input: string | Date): string {
  const iso =
    typeof input === 'string' ? input : input.toISOString();
  return iso.slice(0, 10);
}

/**
 * Returns today's date as a `YYYY-MM-DD` string using local-timezone components.
 */
export function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

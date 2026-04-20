import { formatDate } from '@/lib/dates';

function formatCurrency(value: number) {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  });
  return value < 0 ? `-$${abs}` : `$${abs}`;
}

function formatSignedCurrency(value: number) {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  });
  return value < 0 ? `-$${abs}` : `+$${abs}`;
}

// Recharts passes `active`, `payload`, `label` to custom content components,
// but its exported TooltipProps doesn't surface them cleanly across versions.
// Type them locally instead of fighting the library's types.
interface TooltipPayloadEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface TooltipRenderProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}

interface ChartTooltipProps extends TooltipRenderProps {
  /** If true, render the label through formatDate (for YYYY-MM-DD labels). */
  dateLabel?: boolean;
}

/**
 * Theme-aware tooltip body for recharts charts. Matches the ShadCN popover
 * tokens so the tooltip blends in under both light and dark modes.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  dateLabel,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const renderLabel =
    dateLabel && typeof label === 'string' ? formatDate(label) : label;

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {renderLabel !== undefined && renderLabel !== '' && (
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          {renderLabel}
        </div>
      )}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            {entry.color && (
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
            )}
            <span className="font-medium">
              {entry.name ? `${entry.name}: ` : ''}
              {typeof entry.value === 'number'
                ? formatCurrency(entry.value)
                : String(entry.value ?? '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BalancePoint {
  date: string;
  balance: number;
  description?: string;
  change?: number;
}

/**
 * Tooltip variant for the balance-over-time chart. Shows the date,
 * current balance, and — when the point corresponds to a transaction —
 * that transaction's description and signed change.
 */
export function BalanceTooltip({ active, payload }: TooltipRenderProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as unknown as BalancePoint;
  const dateLabel = formatDate(point.date);
  const hasChange = typeof point.change === 'number';

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        {dateLabel}
      </div>
      <div className="font-semibold">
        Balance: {formatCurrency(point.balance)}
      </div>
      {point.description && (
        <div className="mt-1 text-xs text-muted-foreground">
          {point.description}
        </div>
      )}
      {hasChange && (
        <div
          className={`text-xs font-medium ${
            (point.change ?? 0) >= 0 ? 'text-green-600' : 'text-destructive'
          }`}
        >
          {formatSignedCurrency(point.change ?? 0)}
        </div>
      )}
    </div>
  );
}

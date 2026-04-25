import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportTransactionsDialog } from './ExportTransactionsDialog';
import type { Transaction } from '@/stores/transactions';

const fetchAllTransactions = vi.fn();

vi.mock('@/stores/transactions', () => ({
  useTransactionsStore: {
    getState: () => ({ fetchAllTransactions }),
  },
}));

const sampleTxn = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1',
  userId: 'u',
  accountId: 'acc-1',
  destinationAccountId: null,
  amount: 50,
  type: 'EXPENSE',
  description: 'Coffee',
  date: '2026-04-15T12:00:00.000Z',
  createdAt: '2026-04-15T12:00:00.000Z',
  updatedAt: '2026-04-15T12:00:00.000Z',
  account: { id: 'acc-1', name: 'Checking', type: 'CHECKING' },
  category: { id: 'c1', name: 'Food', color: '#abc' },
  ...overrides,
});

describe('ExportTransactionsDialog', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
    fetchAllTransactions.mockReset();
    fetchAllTransactions.mockResolvedValue([sampleTxn()]);

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  function setup(overrides: Partial<React.ComponentProps<typeof ExportTransactionsDialog>> = {}) {
    const onOpenChange = vi.fn();
    const utils = render(
      <ExportTransactionsDialog
        open
        onOpenChange={onOpenChange}
        baseFilters={{}}
        {...overrides}
      />,
    );
    return { onOpenChange, ...utils };
  }

  it('defaults to "Last 30 days" with computed start/end dates', () => {
    setup();
    const startInput = screen.getByLabelText(/start/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/end/i) as HTMLInputElement;
    expect(endInput.value).toBe('2026-04-25');
    expect(startInput.value).toBe('2026-03-26');
  });

  it('updates the date inputs when a different preset is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /last 60 days/i }));
    const startInput = screen.getByLabelText(/start/i) as HTMLInputElement;
    expect(startInput.value).toBe('2026-02-24');
  });

  it('clears the date inputs when "All time" is selected', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /all time/i }));
    const startInput = screen.getByLabelText(/start/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/end/i) as HTMLInputElement;
    expect(startInput.value).toBe('');
    expect(endInput.value).toBe('');
  });

  it('calls fetchAllTransactions with the resolved filters and triggers a download', async () => {
    const clickSpy = vi.fn();
    const fakeAnchor = { href: '', download: '', click: clickSpy };
    const realCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return fakeAnchor as unknown as HTMLAnchorElement;
      return realCreateElement(tag);
    });

    setup({ baseFilters: { accountId: 'acc-1' }, accountName: 'Checking' });

    fireEvent.click(screen.getByRole('button', { name: /^export$/i }));

    await waitFor(() => expect(fetchAllTransactions).toHaveBeenCalled());
    expect(fetchAllTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acc-1',
        startDate: '2026-03-26',
        endDate: '2026-04-25',
      }),
    );
    expect(clickSpy).toHaveBeenCalled();
    expect(fakeAnchor.download).toContain('checking');
    expect(fakeAnchor.download).toContain('2026-04-25');

    createElementSpy.mockRestore();
  });

  it('omits the date range from the request when "All time" is chosen', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /all time/i }));
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }));

    await waitFor(() => expect(fetchAllTransactions).toHaveBeenCalled());
    const args = fetchAllTransactions.mock.calls[0][0];
    expect(args.startDate).toBeUndefined();
    expect(args.endDate).toBeUndefined();
  });
});

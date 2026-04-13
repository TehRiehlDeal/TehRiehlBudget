import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

import { useTransactionsStore } from './transactions';

describe('useTransactionsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTransactionsStore.setState({
      transactions: [],
      total: 0,
      page: 1,
      loading: false,
    });
  });

  it('should fetch transactions with pagination', async () => {
    const response = {
      data: [{ id: '1', description: 'Grocery run', amount: 42.5 }],
      total: 1,
      page: 1,
      limit: 20,
    };
    mockApi.get.mockResolvedValue(response);

    await useTransactionsStore.getState().fetchTransactions();

    expect(mockApi.get).toHaveBeenCalledWith('/transactions?page=1&limit=20');
    expect(useTransactionsStore.getState().transactions).toEqual(response.data);
    expect(useTransactionsStore.getState().total).toBe(1);
  });

  it('should fetch transactions with filters', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await useTransactionsStore.getState().fetchTransactions({
      accountId: 'acc-1',
      type: 'EXPENSE',
    });

    expect(mockApi.get).toHaveBeenCalledWith(
      '/transactions?page=1&limit=20&accountId=acc-1&type=EXPENSE',
    );
  });

  it('should create a transaction', async () => {
    const newTxn = { id: '2', description: 'Coffee', amount: 5 };
    mockApi.post.mockResolvedValue(newTxn);

    await useTransactionsStore.getState().createTransaction({
      accountId: 'acc-1',
      amount: 5,
      type: 'EXPENSE' as any,
      description: 'Coffee',
      date: '2026-04-10',
    });

    expect(mockApi.post).toHaveBeenCalledWith('/transactions', expect.any(Object));
    expect(useTransactionsStore.getState().transactions).toContainEqual(newTxn);
  });

  it('should delete a transaction', async () => {
    useTransactionsStore.setState({
      transactions: [{ id: '1' } as any, { id: '2' } as any],
      total: 2,
    });
    mockApi.delete.mockResolvedValue({});

    await useTransactionsStore.getState().deleteTransaction('1');

    expect(useTransactionsStore.getState().transactions).toHaveLength(1);
  });
});

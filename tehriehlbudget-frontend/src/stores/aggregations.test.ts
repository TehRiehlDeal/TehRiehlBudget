import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

import { useAggregationsStore } from './aggregations';

describe('useAggregationsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAggregationsStore.setState({
      summary: null,
      spendingByCategory: [],
      loading: false,
    });
  });

  it('should fetch summary data', async () => {
    const mockSummary = { netWorth: 15000, totalDebt: -500, income: 5000, expense: 3200 };
    mockApi.get.mockResolvedValue(mockSummary);

    await useAggregationsStore.getState().fetchSummary('2026-04-01', '2026-04-30');

    expect(mockApi.get).toHaveBeenCalledWith(
      '/aggregations/summary?startDate=2026-04-01&endDate=2026-04-30',
    );
    expect(useAggregationsStore.getState().summary).toEqual(mockSummary);
  });

  it('should fetch spending by category', async () => {
    const mockData = [
      { categoryId: 'cat-1', name: 'Groceries', color: '#4CAF50', amount: 200 },
    ];
    mockApi.get.mockResolvedValue(mockData);

    await useAggregationsStore.getState().fetchSpendingByCategory('2026-04-01', '2026-04-30');

    expect(useAggregationsStore.getState().spendingByCategory).toEqual(mockData);
  });
});

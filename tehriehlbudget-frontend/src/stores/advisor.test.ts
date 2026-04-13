import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

import { useAdvisorStore } from './advisor';

describe('useAdvisorStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdvisorStore.setState({ insights: null, loading: false });
  });

  it('should fetch AI insights', async () => {
    const mockData = {
      insights: '1. Great savings rate!\n2. Reduce dining.',
      generatedAt: '2026-04-12T00:00:00.000Z',
    };
    mockApi.get.mockResolvedValue(mockData);

    await useAdvisorStore.getState().fetchInsights();

    expect(mockApi.get).toHaveBeenCalledWith('/advisor/insights');
    expect(useAdvisorStore.getState().insights).toEqual(mockData);
    expect(useAdvisorStore.getState().loading).toBe(false);
  });
});

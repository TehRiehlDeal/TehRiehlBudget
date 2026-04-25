import { create } from 'zustand';
import { api } from '@/lib/api';

export type EntityType = 'TRANSACTION' | 'ACCOUNT' | 'ACCOUNT_VALUATION';
export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface ActivityLogEntry {
  id: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  action: ActivityAction;
  accountId: string | null;
  destinationAccountId: string | null;
  summary: string | null;
  snapshot: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityFilters {
  entityType?: EntityType;
  action?: ActivityAction;
  accountId?: string;
  startDate?: string;
  endDate?: string;
}

interface ActivityState {
  activities: ActivityLogEntry[];
  total: number;
  page: number;
  loading: boolean;
  fetchActivities: (filters?: ActivityFilters, page?: number) => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  total: 0,
  page: 1,
  loading: false,

  fetchActivities: async (filters = {}, page = 1) => {
    set({ loading: true });
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const result = await api.get<{
      data: ActivityLogEntry[];
      total: number;
      page: number;
      limit: number;
    }>(`/activity?${params.toString()}`);

    set({
      activities: result.data,
      total: result.total,
      page: result.page,
      loading: false,
    });
  },
}));

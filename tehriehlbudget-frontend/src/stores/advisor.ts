import { create } from 'zustand';
import { api } from '@/lib/api';

interface AdvisorInsights {
  insights: string;
  generatedAt: string;
}

interface AdvisorState {
  insights: AdvisorInsights | null;
  loading: boolean;
  fetchInsights: () => Promise<void>;
}

export const useAdvisorStore = create<AdvisorState>((set) => ({
  insights: null,
  loading: false,

  fetchInsights: async () => {
    set({ loading: true });
    const data = await api.get<AdvisorInsights>('/advisor/insights');
    set({ insights: data, loading: false });
  },
}));

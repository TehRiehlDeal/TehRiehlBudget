import { create } from 'zustand';
import { api } from '@/lib/api';

interface Summary {
  netWorth: number;
  totalDebt: number;
  income: number;
  expense: number;
}

interface CategorySpending {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
}

interface CashFlow {
  inflows: number;
  outflows: number;
  net: number;
}

interface AggregationsState {
  summary: Summary | null;
  spendingByCategory: CategorySpending[];
  cashFlow: CashFlow | null;
  loading: boolean;
  fetchSummary: (startDate: string, endDate: string) => Promise<void>;
  fetchSpendingByCategory: (startDate: string, endDate: string) => Promise<void>;
  fetchCashFlow: (startDate: string, endDate: string) => Promise<void>;
}

export const useAggregationsStore = create<AggregationsState>((set) => ({
  summary: null,
  spendingByCategory: [],
  cashFlow: null,
  loading: false,

  fetchSummary: async (startDate, endDate) => {
    set({ loading: true });
    const summary = await api.get<Summary>(
      `/aggregations/summary?startDate=${startDate}&endDate=${endDate}`,
    );
    set({ summary, loading: false });
  },

  fetchSpendingByCategory: async (startDate, endDate) => {
    const data = await api.get<CategorySpending[]>(
      `/aggregations/spending-by-category?startDate=${startDate}&endDate=${endDate}`,
    );
    set({ spendingByCategory: data });
  },

  fetchCashFlow: async (startDate, endDate) => {
    const data = await api.get<CashFlow>(
      `/aggregations/cash-flow?startDate=${startDate}&endDate=${endDate}`,
    );
    set({ cashFlow: data });
  },
}));

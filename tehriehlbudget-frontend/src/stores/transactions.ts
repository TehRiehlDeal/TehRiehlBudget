import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  description: string;
  notes?: string;
  date: string;
  receiptPath?: string;
  category?: { id: string; name: string; color?: string };
  account?: { id: string; name: string; type: string };
  createdAt: string;
  updatedAt: string;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

interface TransactionsState {
  transactions: Transaction[];
  total: number;
  page: number;
  loading: boolean;
  fetchTransactions: (filters?: TransactionFilters, page?: number) => Promise<void>;
  createTransaction: (data: Partial<Transaction>) => Promise<void>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const useTransactionsStore = create<TransactionsState>((set) => ({
  transactions: [],
  total: 0,
  page: 1,
  loading: false,

  fetchTransactions: async (filters = {}, page = 1) => {
    set({ loading: true });
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const result = await api.get<{
      data: Transaction[];
      total: number;
      page: number;
      limit: number;
    }>(`/transactions?${params.toString()}`);

    set({
      transactions: result.data,
      total: result.total,
      page: result.page,
      loading: false,
    });
  },

  createTransaction: async (data) => {
    const transaction = await api.post<Transaction>('/transactions', data);
    set((state) => ({ transactions: [transaction, ...state.transactions] }));
  },

  updateTransaction: async (id, data) => {
    const updated = await api.patch<Transaction>(`/transactions/${id}`, data);
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTransaction: async (id) => {
    await api.delete(`/transactions/${id}`);
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
      total: state.total - 1,
    }));
  },
}));

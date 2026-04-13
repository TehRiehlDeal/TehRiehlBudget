import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'LOAN' | 'STOCK';
  balance: number;
  institution?: string;
  accountNumber?: string;
  createdAt: string;
  updatedAt: string;
}

interface AccountsState {
  accounts: Account[];
  loading: boolean;
  fetchAccounts: () => Promise<void>;
  createAccount: (data: Partial<Account>) => Promise<void>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
}

export const useAccountsStore = create<AccountsState>((set) => ({
  accounts: [],
  loading: false,

  fetchAccounts: async () => {
    set({ loading: true });
    const accounts = await api.get<Account[]>('/accounts');
    set({ accounts, loading: false });
  },

  createAccount: async (data) => {
    const account = await api.post<Account>('/accounts', data);
    set((state) => ({ accounts: [...state.accounts, account] }));
  },

  updateAccount: async (id, data) => {
    const updated = await api.patch<Account>(`/accounts/${id}`, data);
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteAccount: async (id) => {
    await api.delete(`/accounts/${id}`);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    }));
  },
}));

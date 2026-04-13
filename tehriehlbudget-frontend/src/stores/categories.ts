import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Category {
  id: string;
  userId: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

interface CategoriesState {
  categories: Category[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (data: Partial<Category>) => Promise<void>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategoriesStore = create<CategoriesState>((set) => ({
  categories: [],
  loading: false,

  fetchCategories: async () => {
    set({ loading: true });
    const categories = await api.get<Category[]>('/categories');
    set({ categories, loading: false });
  },

  createCategory: async (data) => {
    const category = await api.post<Category>('/categories', data);
    set((state) => ({ categories: [...state.categories, category] }));
  },

  updateCategory: async (id, data) => {
    const updated = await api.patch<Category>(`/categories/${id}`, data);
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCategory: async (id) => {
    await api.delete(`/categories/${id}`);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
  },
}));

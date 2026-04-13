import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

import { useCategoriesStore } from './categories';

describe('useCategoriesStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCategoriesStore.setState({ categories: [], loading: false });
  });

  it('should fetch and store categories', async () => {
    const cats = [{ id: '1', name: 'Groceries', color: '#4CAF50' }];
    mockApi.get.mockResolvedValue(cats);

    await useCategoriesStore.getState().fetchCategories();

    expect(mockApi.get).toHaveBeenCalledWith('/categories');
    expect(useCategoriesStore.getState().categories).toEqual(cats);
  });

  it('should create and append category', async () => {
    const newCat = { id: '2', name: 'Dining', color: '#FF9800' };
    mockApi.post.mockResolvedValue(newCat);

    await useCategoriesStore.getState().createCategory({ name: 'Dining', color: '#FF9800' });

    expect(useCategoriesStore.getState().categories).toContainEqual(newCat);
  });

  it('should update a category', async () => {
    useCategoriesStore.setState({ categories: [{ id: '1', name: 'Old' } as any] });
    mockApi.patch.mockResolvedValue({ id: '1', name: 'New' });

    await useCategoriesStore.getState().updateCategory('1', { name: 'New' });

    expect(useCategoriesStore.getState().categories[0].name).toBe('New');
  });

  it('should delete a category', async () => {
    useCategoriesStore.setState({ categories: [{ id: '1' } as any, { id: '2' } as any] });
    mockApi.delete.mockResolvedValue({});

    await useCategoriesStore.getState().deleteCategory('1');

    expect(useCategoriesStore.getState().categories).toHaveLength(1);
  });
});

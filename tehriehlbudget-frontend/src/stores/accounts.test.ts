import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

import { useAccountsStore } from './accounts';

describe('useAccountsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAccountsStore.setState({ accounts: [], loading: false });
  });

  it('should have empty initial state', () => {
    const state = useAccountsStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.loading).toBe(false);
  });

  describe('fetchAccounts', () => {
    it('should fetch and store accounts', async () => {
      const mockAccounts = [{ id: '1', name: 'Checking', type: 'CHECKING', balance: 1000 }];
      mockApi.get.mockResolvedValue(mockAccounts);

      await useAccountsStore.getState().fetchAccounts();

      expect(mockApi.get).toHaveBeenCalledWith('/accounts');
      expect(useAccountsStore.getState().accounts).toEqual(mockAccounts);
      expect(useAccountsStore.getState().loading).toBe(false);
    });
  });

  describe('createAccount', () => {
    it('should create and append account', async () => {
      const newAccount = { id: '2', name: 'Savings', type: 'SAVINGS', balance: 5000 };
      mockApi.post.mockResolvedValue(newAccount);

      await useAccountsStore.getState().createAccount({ name: 'Savings', type: 'SAVINGS' as any });

      expect(mockApi.post).toHaveBeenCalledWith('/accounts', { name: 'Savings', type: 'SAVINGS' });
      expect(useAccountsStore.getState().accounts).toContainEqual(newAccount);
    });
  });

  describe('updateAccount', () => {
    it('should update an account in state', async () => {
      useAccountsStore.setState({
        accounts: [{ id: '1', name: 'Old', type: 'CHECKING', balance: 0 } as any],
      });
      const updated = { id: '1', name: 'Updated', type: 'CHECKING', balance: 0 };
      mockApi.patch.mockResolvedValue(updated);

      await useAccountsStore.getState().updateAccount('1', { name: 'Updated' });

      expect(mockApi.patch).toHaveBeenCalledWith('/accounts/1', { name: 'Updated' });
      expect(useAccountsStore.getState().accounts[0].name).toBe('Updated');
    });
  });

  describe('deleteAccount', () => {
    it('should remove account from state', async () => {
      useAccountsStore.setState({
        accounts: [{ id: '1', name: 'Checking' } as any, { id: '2', name: 'Savings' } as any],
      });
      mockApi.delete.mockResolvedValue({});

      await useAccountsStore.getState().deleteAccount('1');

      expect(mockApi.delete).toHaveBeenCalledWith('/accounts/1');
      expect(useAccountsStore.getState().accounts).toHaveLength(1);
      expect(useAccountsStore.getState().accounts[0].id).toBe('2');
    });
  });
});

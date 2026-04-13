import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

import { useAuthStore } from './auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      session: null,
      loading: false,
    });
  });

  it('should have initial state with no user and no session', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.loading).toBe(false);
  });

  describe('login', () => {
    it('should set user and session on successful login', async () => {
      const mockSession = { access_token: 'token', user: { id: '123', email: 'test@test.com' } };
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      await useAuthStore.getState().login('test@test.com', 'password');

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockSession.user);
      expect(state.loading).toBe(false);
    });

    it('should throw on login failure', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(useAuthStore.getState().login('bad@test.com', 'wrong')).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('signup', () => {
    it('should set user and session on successful signup', async () => {
      const mockSession = { access_token: 'token', user: { id: '456', email: 'new@test.com' } };
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      await useAuthStore.getState().signup('new@test.com', 'password');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockSession.user);
    });

    it('should throw on signup failure', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Email taken' },
      });

      await expect(useAuthStore.getState().signup('taken@test.com', 'pass')).rejects.toThrow(
        'Email taken',
      );
    });
  });

  describe('logout', () => {
    it('should clear user and session on logout', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      useAuthStore.setState({
        user: { id: '123' } as any,
        session: { access_token: 'token' } as any,
      });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
    });
  });
});

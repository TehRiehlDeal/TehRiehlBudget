import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: null,
    session: null,
    loading: false,
    initialize: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    signup: vi.fn(),
  })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

import App from './App';

describe('App', () => {
  it('renders login page when not authenticated', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeTruthy();
  });
});

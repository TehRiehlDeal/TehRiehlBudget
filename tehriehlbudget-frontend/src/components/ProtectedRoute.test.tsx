import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

// Mock the auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '@/stores/auth';

describe('ProtectedRoute', () => {
  it('should show loading when auth is loading', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      loading: true,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('should render children when user is authenticated', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: '123', email: 'test@test.com' },
      loading: false,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected Content')).toBeTruthy();
  });

  it('should redirect to /login when user is not authenticated', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Protected Content')).toBeNull();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { email: 'test@test.com' } as any,
    logout: vi.fn(),
  })),
}));

vi.mock('@/stores/theme', () => ({
  useThemeStore: vi.fn(() => ({
    theme: 'system' as const,
    resolved: 'light' as const,
    setTheme: vi.fn(),
  })),
}));

import { AppLayout } from './AppLayout';

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<div>Home Content</div>} />
          <Route path="/accounts" element={<div>Accounts Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  it('renders navigation links', () => {
    renderLayout();
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Accounts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Transactions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Categories').length).toBeGreaterThan(0);
  });

  it('renders outlet content', () => {
    renderLayout();
    expect(screen.getByText('Home Content')).toBeTruthy();
  });

  it('shows mobile hamburger button', () => {
    renderLayout();
    expect(screen.getByLabelText('Open menu')).toBeTruthy();
  });

  it('opens drawer when hamburger clicked and closes via backdrop', () => {
    renderLayout();
    const backdropBefore = document.querySelector('[data-drawer-backdrop]');
    expect(backdropBefore?.classList.contains('opacity-0')).toBe(true);

    fireEvent.click(screen.getByLabelText('Open menu'));
    const backdropAfter = document.querySelector('[data-drawer-backdrop]');
    expect(backdropAfter?.classList.contains('opacity-100')).toBe(true);

    fireEvent.click(backdropAfter!);
    const backdropClosed = document.querySelector('[data-drawer-backdrop]');
    expect(backdropClosed?.classList.contains('opacity-0')).toBe(true);
  });

  it('renders theme toggle buttons', () => {
    renderLayout();
    // one in desktop sidebar, one in mobile top bar
    expect(screen.getAllByLabelText(/toggle theme/i).length).toBeGreaterThan(0);
  });
});

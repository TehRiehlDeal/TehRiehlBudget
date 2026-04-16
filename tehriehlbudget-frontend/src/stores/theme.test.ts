import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('useThemeStore', () => {
  let matchMediaListener: ((e: { matches: boolean }) => void) | null = null;
  let prefersDark = false;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    matchMediaListener = null;
    prefersDark = false;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark') ? prefersDark : false,
        media: query,
        addEventListener: (_e: string, cb: (e: { matches: boolean }) => void) => {
          matchMediaListener = cb;
        },
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('defaults to system preference when no stored value (light system)', async () => {
    prefersDark = false;
    const { useThemeStore } = await import('./theme');
    useThemeStore.getState().initialize();
    expect(useThemeStore.getState().theme).toBe('system');
    expect(useThemeStore.getState().resolved).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('defaults to system preference when no stored value (dark system)', async () => {
    prefersDark = true;
    const { useThemeStore } = await import('./theme');
    useThemeStore.getState().initialize();
    expect(useThemeStore.getState().theme).toBe('system');
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme("dark") adds .dark to html and persists', async () => {
    const { useThemeStore } = await import('./theme');
    useThemeStore.getState().initialize();
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('setTheme("light") removes .dark and persists', async () => {
    prefersDark = true;
    const { useThemeStore } = await import('./theme');
    useThemeStore.getState().initialize();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(useThemeStore.getState().resolved).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('setTheme("system") re-reads media query', async () => {
    prefersDark = true;
    const { useThemeStore } = await import('./theme');
    useThemeStore.getState().initialize();
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().resolved).toBe('light');

    useThemeStore.getState().setTheme('system');
    expect(useThemeStore.getState().theme).toBe('system');
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('system');
  });

  it('restores persisted theme from localStorage on initialize', async () => {
    localStorage.setItem('theme', 'dark');
    const { useThemeStore } = await import('./theme');
    useThemeStore.getState().initialize();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('responds to system preference change when in system mode', async () => {
    prefersDark = false;
    const { useThemeStore } = await import('./theme');
    useThemeStore.getState().initialize();
    expect(useThemeStore.getState().resolved).toBe('light');

    // simulate OS theme change
    matchMediaListener?.({ matches: true });
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  initialize: () => void;
}

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemPreference() : theme;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  resolved: 'light',

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    localStorage.setItem('theme', theme);
    applyTheme(resolved);
    set({ theme, resolved });
  },

  initialize: () => {
    const stored = (localStorage.getItem('theme') as Theme | null) ?? 'system';
    const resolved = resolveTheme(stored);
    applyTheme(resolved);
    set({ theme: stored, resolved });

    // Listen for system preference changes when in system mode
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', (e) => {
      if (get().theme === 'system') {
        const next: ResolvedTheme = e.matches ? 'dark' : 'light';
        applyTheme(next);
        set({ resolved: next });
      }
    });
  },
}));

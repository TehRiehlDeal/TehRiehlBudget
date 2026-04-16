import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const STAY_LOGGED_IN_KEY = 'auth:stay_logged_in';

/**
 * Returns true if the user opted to persist sessions across browser restarts.
 * Defaults to true when no preference has been set yet.
 */
export function getStayLoggedIn(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(STAY_LOGGED_IN_KEY);
  return stored === null ? true : stored === 'true';
}

export function setStayLoggedIn(value: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STAY_LOGGED_IN_KEY, String(value));
}

/**
 * Storage adapter that writes Supabase session tokens to either localStorage
 * (persistent across browser restarts) or sessionStorage (cleared on close),
 * based on the user's "Stay Logged In" preference. Reads fall back between
 * both so the session is discoverable after a preference change.
 */
const authStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    return (
      window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
    );
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    const target = getStayLoggedIn() ? window.localStorage : window.sessionStorage;
    const other = getStayLoggedIn() ? window.sessionStorage : window.localStorage;
    target.setItem(key, value);
    other.removeItem(key);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

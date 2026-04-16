import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, getStayLoggedIn, setStayLoggedIn } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  stayLoggedIn: boolean;
  setStayLoggedIn: (value: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  // Start in a loading state so protected routes show a spinner instead of
  // bouncing to /login during the brief window before the session is restored.
  loading: true,
  stayLoggedIn: getStayLoggedIn(),

  setStayLoggedIn: (value) => {
    setStayLoggedIn(value);
    set({ stayLoggedIn: value });
  },

  login: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ loading: false });
      throw new Error(error.message);
    }
    set({ user: data.user, session: data.session, loading: false });
  },

  signup: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ loading: false });
      throw new Error(error.message);
    }
    set({ user: data.user, session: data.session, loading: false });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  initialize: async () => {
    set({ loading: true });
    const { data } = await supabase.auth.getSession();
    set({
      user: data.session?.user ?? null,
      session: data.session,
      loading: false,
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, session });
    });
  },
}));

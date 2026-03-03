import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { GeoLocation, Intent, User } from "../types";
import { supabase } from "../lib/supabase";

interface SessionState {
  // Auth
  supabaseSession: Session | null;
  isAuthenticated: boolean;

  // User profile
  user: User | null;

  // Current session context
  sessionId: string | null;
  location: GeoLocation | null;
  intent: Intent | null;
  groupSize: number;

  // Auth actions
  setSession: (session: Session | null) => void;
  clearAuth: () => void;
  initialize: () => () => void;

  // User actions
  setUser: (user: User | null) => void;

  // Session actions
  setSessionId: (id: string) => void;
  setLocation: (location: GeoLocation) => void;
  setIntent: (intent: Intent | null) => void;
  setGroupSize: (size: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Auth
  supabaseSession: null,
  isAuthenticated: false,

  // User profile
  user: null,

  // Current session context
  sessionId: null,
  location: null,
  intent: null,
  groupSize: 1,

  // Auth actions
  setSession: (session) =>
    set({ supabaseSession: session, isAuthenticated: session !== null }),
  clearAuth: () =>
    set({
      supabaseSession: null,
      isAuthenticated: false,
      user: null,
    }),

  initialize: () => {
    // Fetch current session on startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ supabaseSession: session, isAuthenticated: session !== null });
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ supabaseSession: session, isAuthenticated: session !== null });
    });

    return () => subscription.unsubscribe();
  },

  // User actions
  setUser: (user) => set({ user }),

  // Session actions
  setSessionId: (sessionId) => set({ sessionId }),
  setLocation: (location) => set({ location }),
  setIntent: (intent) => set({ intent }),
  setGroupSize: (groupSize) => set({ groupSize }),
}));

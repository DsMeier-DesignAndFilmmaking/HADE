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
  llmProvider: "gemini" | "openai"; // Add this
  setLLMProvider: (provider: "gemini" | "openai") => void; // Add this

  // Current session context
  sessionId: string | null;
  location: GeoLocation | null;
  intent: Intent | null;
  groupSize: number;

  // Auth actions
  setSession: (session: Session | null) => void;
  clearAuth: () => void;
  initialize: () => () => void;
  // Global OAuth handshake flag — prevents navigation flicker while the
  // Google sign-in sheet is open and the code exchange is in-flight.
  authLoading: boolean;
  setAuthLoading: (loading: boolean) => void;

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
  llmProvider: "gemini", // Default
  setLLMProvider: (llmProvider) => set({ llmProvider }),

  // Current session context
  sessionId: null,
  location: null,
  intent: null,
  groupSize: 1,

  // Auth actions
  authLoading: false,
  setAuthLoading: (authLoading) => set({ authLoading }),
  setSession: (session) =>
    set({ supabaseSession: session, isAuthenticated: session !== null }),
  clearAuth: () =>
    set({
      supabaseSession: null,
      isAuthenticated: false,
      user: null,
      authLoading: false,
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

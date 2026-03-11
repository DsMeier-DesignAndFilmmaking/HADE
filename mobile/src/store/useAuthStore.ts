import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { AuthStatus } from "../types";
import { supabase } from "../lib/supabase";

interface AuthState {
  supabaseSession: Session | null;
  authStatus: AuthStatus;
  guestSessionId: string | null;

  setSession: (session: Session | null) => void;
  setAuthStatus: (status: AuthStatus) => void;
  setGuestSessionId: (id: string | null) => void;
  clearAuth: () => void;
  initialize: () => () => void;
  migrateFromGuest: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  supabaseSession: null,
  authStatus: "LOADING",
  guestSessionId: null,

  setSession: (session) => {
    const authStatus: AuthStatus = session
      ? session.user.is_anonymous
        ? "GUEST"
        : "AUTHENTICATED"
      : "UNAUTHENTICATED"; // Corrected from LOADING to prevent hangs
    set({ supabaseSession: session, authStatus });
  },

  setAuthStatus: (authStatus) => set({ authStatus }),
  setGuestSessionId: (guestSessionId) => set({ guestSessionId }),

  clearAuth: () =>
    set({
      supabaseSession: null,
      authStatus: "UNAUTHENTICATED",
      guestSessionId: null,
    }),

  initialize: () => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        set({ supabaseSession: null, authStatus: "UNAUTHENTICATED" });
        return;
      }
      
      const isGuest = session.user.is_anonymous;
      set({ 
        supabaseSession: session, 
        authStatus: isGuest ? "GUEST" : "AUTHENTICATED",
        guestSessionId: isGuest ? session.user.id : null
      });
    });

    // 2. Auth State Subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const prevStatus = get().authStatus;

      if (!session) {
        set({ supabaseSession: null, authStatus: "UNAUTHENTICATED" });
        return;
      }

      const newStatus: AuthStatus = session.user.is_anonymous ? "GUEST" : "AUTHENTICATED";
      
      set({ 
        supabaseSession: session, 
        authStatus: newStatus,
        // Update guest ID if we just entered guest mode
        ...(newStatus === "GUEST" ? { guestSessionId: session.user.id } : {})
      });

      // Handle Guest -> Authenticated migration
      if (prevStatus === "GUEST" && newStatus === "AUTHENTICATED") {
        get().migrateFromGuest();
      }
    });

    return () => subscription.unsubscribe();
  },

  migrateFromGuest: async () => {
    const guestId = get().guestSessionId;
    if (!guestId) return;

    try {
      // Use a standard import if possible, otherwise use 'await import' 
      // with the TSConfig 'module' set to 'esnext' or 'commonjs'
      const api = await import("../services/api");
      
      // Accessing via bracket notation helps if TS is still being picky about the export
      if (api && typeof api.migrateGuestSession === 'function') {
        await api.migrateGuestSession(guestId);
        console.log("[HADE Auth] Guest session migrated successfully");
      }
    } catch (err) {
      console.warn("[HADE Auth] Guest migration failed (non-blocking):", err);
    } finally {
      set({ guestSessionId: null });
    }
  },
}));
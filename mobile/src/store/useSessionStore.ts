import { create } from "zustand";
import type { GeoLocation, Intent, User } from "../types";

interface SessionState {
  // Auth
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // User profile
  user: User | null;

  // Current session context
  sessionId: string | null;
  location: GeoLocation | null;
  intent: Intent | null;
  groupSize: number;

  // Auth actions
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;

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
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  // User profile
  user: null,

  // Current session context
  sessionId: null,
  location: null,
  intent: null,
  groupSize: 1,

  // Auth actions
  setTokens: (accessToken, refreshToken) =>
    set({ accessToken, refreshToken, isAuthenticated: true }),
  clearAuth: () =>
    set({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      user: null,
    }),

  // User actions
  setUser: (user) => set({ user }),

  // Session actions
  setSessionId: (sessionId) => set({ sessionId }),
  setLocation: (location) => set({ location }),
  setIntent: (intent) => set({ intent }),
  setGroupSize: (groupSize) => set({ groupSize }),
}));

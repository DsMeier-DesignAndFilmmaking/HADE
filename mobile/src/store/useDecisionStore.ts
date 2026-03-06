import { create } from "zustand";
import type { DecideResponse } from "../types";
import type { SignalVibe } from "../types";

export interface MapViewport {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface DecisionState {
  decision: DecideResponse | null;
  lastMapViewport: MapViewport | null;
  activeOpportunityId: string | null;
  blockedVenueIds: string[];
  setDecision: (decision: DecideResponse | null) => void;
  setDecisionAsync: (decision: DecideResponse | null) => Promise<DecideResponse | null>;
  clearDecision: () => void;
  setLastMapViewport: (viewport: MapViewport) => void;
  registerSignalFeedback: (venueId: string, vibe: SignalVibe) => void;
}

export const useDecisionStore = create<DecisionState>((set) => ({
  decision: null,
  lastMapViewport: null,
  activeOpportunityId: null,
  blockedVenueIds: [],
  setDecision: (decision) =>
    set({
      decision,
      activeOpportunityId: decision?.primary?.id ?? null,
    }),
  setDecisionAsync: async (decision) => {
    set({
      decision,
      activeOpportunityId: decision?.primary?.id ?? null,
    });
    return decision;
  },
  clearDecision: () =>
    set({
      decision: null,
      activeOpportunityId: null,
      lastMapViewport: null,
    }),
  setLastMapViewport: (viewport) => set({ lastMapViewport: viewport }),
  registerSignalFeedback: (venueId, vibe) =>
    set((state) => {
      // Non-avoid vibes don't mutate store state — same reference → no notification.
      if (vibe !== "avoid") return state;

      const alreadyBlocked = state.blockedVenueIds.includes(venueId);
      const isActive = state.activeOpportunityId === venueId;

      // Nothing to change — return same reference so Zustand skips notification.
      if (alreadyBlocked && !isActive) return state;

      // Only return the properties that actually changed (Zustand shallow-merges).
      const blockedVenueIds = alreadyBlocked
        ? state.blockedVenueIds
        : [...state.blockedVenueIds, venueId];

      if (!isActive) {
        return { blockedVenueIds };
      }

      // Active venue avoided — clear decision entirely so DecideScreen resets.
      return {
        blockedVenueIds,
        activeOpportunityId: null,
        decision: null,
        lastMapViewport: null,
      };
    }),
}));

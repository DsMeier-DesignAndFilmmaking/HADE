/**
 * HADE web demo — mock venue and decision data.
 * 6 real Denver venues with coordinates, signals, and trust attributions.
 */
import type { Opportunity, DecideResponse, Intent } from "./types";

/** Helper: returns an ISO timestamp N minutes in the past */
function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

// ─── Venues ─────────────────────────────────────────────

export const VENUES: Opportunity[] = [
  {
    id: "hade-001",
    venue_name: "Union Station Lodge",
    category: "Cocktails & Chill",
    eta_minutes: 12,
    distance_meters: 950,
    rationale:
      "The lighting is dimmed to 20% and the fireplace is active.",
    trust_attributions: [
      {
        user_name: "Maya",
        signal_summary: "Calibrated 15m ago",
        vibe_label: "Solid",
      },
    ],
    primary_signal: {
      user_name: "Maya",
      timestamp: minutesAgo(15),
      vibe_label: "Solid",
      comment: "Bartender is making off-menu old fashioneds tonight.",
    },
    geo: { lat: 39.7527, lng: -104.9997 },
    is_primary: true,
    event: null,
    neighborhood: "LoDo",
  },
  {
    id: "hade-002",
    venue_name: "Death & Co Denver",
    category: "Speakeasy",
    eta_minutes: 18,
    distance_meters: 1400,
    rationale: "Three open seats at the bar. Low music, candlelit.",
    trust_attributions: [
      {
        user_name: "Jordan",
        signal_summary: "Verified 42m ago",
      },
    ],
    primary_signal: null,
    geo: { lat: 39.7481, lng: -104.9877 },
    is_primary: false,
    event: null,
    neighborhood: "RiNo",
  },
  {
    id: "hade-003",
    venue_name: "Williams & Graham",
    category: "Hidden Bar",
    eta_minutes: 22,
    distance_meters: 1800,
    rationale:
      "The bookshelf door just opened for a fresh rotation.",
    trust_attributions: [
      {
        user_name: "Alex",
        signal_summary: "Confirmed vibe 1h ago",
      },
    ],
    primary_signal: null,
    geo: { lat: 39.7621, lng: -105.0067 },
    is_primary: false,
    event: null,
    neighborhood: "LoHi",
  },
  {
    id: "hade-004",
    venue_name: "Hop Alley",
    category: "Late Night Eats",
    eta_minutes: 14,
    distance_meters: 1100,
    rationale: "Kitchen open until midnight. Dan dan noodles are on.",
    trust_attributions: [
      {
        user_name: "Sam",
        signal_summary: "Was here 30m ago",
      },
    ],
    primary_signal: {
      user_name: "Sam",
      timestamp: minutesAgo(30),
      vibe_label: "Chill",
      comment: "Half the tables open, music is right.",
    },
    geo: { lat: 39.7548, lng: -104.9998 },
    is_primary: false,
    event: null,
    neighborhood: "LoDo",
  },
  {
    id: "hade-005",
    venue_name: "Bar Standard",
    category: "DJ & Dancefloor",
    eta_minutes: 8,
    distance_meters: 650,
    rationale:
      "DJ Kush just started a house set. Cover is waived until 11.",
    trust_attributions: [
      {
        user_name: "Priya",
        signal_summary: "Just arrived",
      },
    ],
    primary_signal: {
      user_name: "Priya",
      timestamp: minutesAgo(5),
      vibe_label: "Solid",
      comment: "Dancefloor is filling up, energy is perfect.",
    },
    geo: { lat: 39.7498, lng: -104.9998 },
    is_primary: false,
    event: null,
    neighborhood: "LoDo",
  },
  {
    id: "hade-006",
    venue_name: "Improper City",
    category: "Beer Garden & Vibes",
    eta_minutes: 16,
    distance_meters: 1300,
    rationale:
      "Fire pits are lit. Crowd is mellow. Perfect Friday wind-down.",
    trust_attributions: [
      {
        user_name: "Drew",
        signal_summary: "Calibrated 1h ago",
      },
    ],
    primary_signal: null,
    geo: { lat: 39.7711, lng: -104.9813 },
    is_primary: false,
    event: null,
    neighborhood: "RiNo",
  },
];

// ─── Intent → Primary venue mapping ─────────────────────

const INTENT_PRIMARY: Record<string, number> = {
  drink: 0, // Union Station Lodge
  eat: 3, // Hop Alley
  scene: 4, // Bar Standard
  chill: 5, // Improper City
  anything: 0,
};

/** Returns a mock DecideResponse for a given intent. */
export function mockDecide(intent: Intent): DecideResponse {
  const primaryIdx = INTENT_PRIMARY[intent] ?? 0;
  const primary = { ...VENUES[primaryIdx], is_primary: true };
  const fallbacks = VENUES.filter((_, i) => i !== primaryIdx)
    .slice(0, 2)
    .map((v) => ({ ...v, is_primary: false }));

  return {
    primary,
    fallbacks,
    context_state_id: "ctx-demo-001",
    provider: "gemini-2.5-flash",
  };
}

/** User's simulated position: central Denver near Union Station. */
export const USER_LOCATION = { lat: 39.7541, lng: -104.9998 };

/**
 * HADE web demo — mock venue and decision data.
 * 6 real Denver venues with coordinates, signals, and trust attributions.
 *
 * mockDecide() accepts an optional userLocation so distance_meters and
 * eta_minutes are computed dynamically against the caller's actual coordinates.
 */
import type { Opportunity, DecideResponse, Intent } from "./types";

/** Helper: returns an ISO timestamp N minutes in the past */
function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

// ─── Haversine distance ──────────────────────────────────

/** Returns distance in metres between two lat/lng points. */
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

/** Walking speed: ~83 m/min (5 km/h). Returns rounded minutes. */
function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 83));
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

/**
 * Returns a mock DecideResponse for a given intent.
 *
 * When `userLocation` is provided, `distance_meters` and `eta_minutes` are
 * recomputed using the real Haversine distance so the UI reflects the caller's
 * actual position rather than the hardcoded Denver origin.
 */
export function mockDecide(
  intent: Intent,
  userLocation?: { lat: number; lng: number }
): DecideResponse {
  if (userLocation) {
    console.log(
      "%cHADE: Using location-aware mock data",
      "color: #22C55E; font-weight: bold;",
      `(${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}) — real distances computed`
    );
  } else {
    console.warn(
      "%cHADE: Falling back to Denver Mock — no coordinates received",
      "color: #F59E0B; font-weight: bold;"
    );
  }

  const primaryIdx = INTENT_PRIMARY[intent] ?? 0;

  const applyLocation = (v: Opportunity): Opportunity => {
    if (!userLocation) return v;
    const meters = Math.round(haversineMeters(userLocation, v.geo));
    return { ...v, distance_meters: meters, eta_minutes: walkingMinutes(meters) };
  };

  const primary = applyLocation({ ...VENUES[primaryIdx], is_primary: true });
  const fallbacks = VENUES.filter((_, i) => i !== primaryIdx)
    .slice(0, 2)
    .map((v) => applyLocation({ ...v, is_primary: false }));

  return {
    primary,
    fallbacks,
    context_state_id: "ctx-demo-001",
    provider: "gemini-2.5-flash",
  };
}

/**
 * Raleigh, NC test coordinates.
 * Swap `userLocation` in the decision call for validation:
 *   mockDecide("drink", TEST_NC_LOCATION)
 * Expected: distance_meters ~2,800,000 (2,800 km to Denver venues),
 * confirming location is flowing through and not silently defaulting to Denver.
 */
export const TEST_NC_LOCATION = { lat: 35.7796, lng: -78.6382 };

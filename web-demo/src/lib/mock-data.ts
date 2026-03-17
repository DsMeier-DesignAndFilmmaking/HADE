/**
 * HADE web demo — mock venue and decision data.
 * 6 demo venues with signals and trust attributions.
 *
 * Venue geo coordinates are computed dynamically as offsets from the user's
 * real GPS position so the map and navigation links work anywhere in the world.
 * Denver coordinates have been removed entirely.
 *
 * mockDecide() accepts an optional userLocation and injects computed geo and
 * directional neighbourhood labels into each returned Opportunity.
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

// ─── Per-venue geo offsets ────────────────────────────────────────────────────
// Each venue is positioned at a fixed offset from the user's actual GPS position.
// northMeters: positive = north, negative = south
// eastMeters:  positive = east,  negative = west
// Magnitudes are chosen so euclidean distance matches each venue's stored
// distance_meters to within ~4%.

interface VenueOffset {
  northMeters: number;
  eastMeters: number;
  /** Direction label shown in UI in place of Denver neighbourhood names */
  direction: string;
}

const VENUE_OFFSETS: Record<string, VenueOffset> = {
  "hade-001": { northMeters:  -450, eastMeters:   800, direction: "Southeast" },
  "hade-002": { northMeters:   900, eastMeters:  1050, direction: "Northeast" },
  "hade-003": { northMeters: -1250, eastMeters: -1400, direction: "Southwest" },
  "hade-004": { northMeters:   350, eastMeters: -1050, direction: "Northwest" },
  "hade-005": { northMeters:  -600, eastMeters:  -250, direction: "South"     },
  "hade-006": { northMeters:  -300, eastMeters:  1250, direction: "East"      },
};

const DEFAULT_GEO = { lat: 0, lng: 0 };

/**
 * Computes venue coordinates as a fixed offset from the user's actual GPS position.
 * If no userLocation is provided, returns DEFAULT_GEO (null island) — callers are
 * expected to guard against absent location before reaching this path.
 *
 * Conversion math:
 *   deltaLat = northMeters / 111_320
 *   deltaLng = eastMeters  / (111_320 * cos(userLat_radians))
 *
 * The cosine term accounts for longitude convergence at high latitudes and keeps
 * the euclidean distance correct anywhere on Earth.
 */
export function generateDynamicGeo(
  userLocation: { lat: number; lng: number } | undefined,
  venueId: string
): { lat: number; lng: number } {
  if (!userLocation) return { ...DEFAULT_GEO };
  const offset = VENUE_OFFSETS[venueId];
  if (!offset) return { ...userLocation };
  const LAT_DEG_PER_METER = 1 / 111_320;
  const LNG_DEG_PER_METER =
    1 / (111_320 * Math.cos((userLocation.lat * Math.PI) / 180));
  return {
    lat: userLocation.lat + offset.northMeters * LAT_DEG_PER_METER,
    lng: userLocation.lng + offset.eastMeters  * LNG_DEG_PER_METER,
  };
}

// ─── Venues ─────────────────────────────────────────────
// geo and neighborhood are injected at runtime by mockDecide via generateDynamicGeo.

type VenueTemplate = Omit<Opportunity, "geo" | "neighborhood">;

export const VENUES: VenueTemplate[] = [
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
    is_primary: true,
    event: null,
  },
  {
    id: "hade-002",
    venue_name: "Death & Co",
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
    is_primary: false,
    event: null,
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
    is_primary: false,
    event: null,
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
    is_primary: false,
    event: null,
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
    is_primary: false,
    event: null,
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
    is_primary: false,
    event: null,
  },
];

// ─── Intent → Primary venue mapping ─────────────────────

const INTENT_PRIMARY: Record<string, number> = {
  drink: 0, // Union Station Lodge
  eat: 3,   // Hop Alley
  scene: 4, // Bar Standard
  chill: 5, // Improper City
  anything: 0,
};

/**
 * Returns a mock DecideResponse for a given intent.
 *
 * When `userLocation` is provided, venue geo coordinates are computed as offsets
 * from the user's actual position via generateDynamicGeo, then distance_meters
 * and eta_minutes are recomputed using the real Haversine distance. The result
 * is location-correct anywhere in the world — not just Denver.
 */
export function mockDecide(
  intent: Intent,
  userLocation?: { lat: number; lng: number }
): DecideResponse {
  if (userLocation) {
    console.log(
      "%cHADE: Using location-aware mock data",
      "color: #22C55E; font-weight: bold;",
      `(${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}) — dynamic geo injected`
    );
  } else {
    console.warn(
      "%cHADE: Falling back to null-island geo — no coordinates received",
      "color: #F59E0B; font-weight: bold;"
    );
  }

  const primaryIdx = INTENT_PRIMARY[intent] ?? 0;

  const enrich = (v: VenueTemplate, overridePrimary?: boolean): Opportunity => {
    const geo = generateDynamicGeo(userLocation, v.id);
    const neighborhood = VENUE_OFFSETS[v.id]?.direction;
    const base: Opportunity = {
      ...v,
      geo,
      neighborhood,
      is_primary: overridePrimary ?? v.is_primary,
    };
    if (!userLocation) return base;
    const meters = Math.round(haversineMeters(userLocation, geo));
    return { ...base, distance_meters: meters, eta_minutes: walkingMinutes(meters) };
  };

  const primary = enrich(VENUES[primaryIdx], true);
  const fallbacks = VENUES.filter((_, i) => i !== primaryIdx)
    .slice(0, 2)
    .map((v) => enrich(v, false));

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
 * Expected: distance_meters ~950m (venues are offset relative to user position),
 * confirming Denver coordinates are no longer used.
 */
export const TEST_NC_LOCATION = { lat: 35.7796, lng: -78.6382 };

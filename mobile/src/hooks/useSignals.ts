import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSupabaseSession, supabase } from "../lib/supabase";
import type {
  InsertSignalWithLocationArgs,
  SignalRow,
} from "../services/supabase/types";
import type { GeoLocation, Signal, SignalCreate } from "../types";

const SIGNALS_QUERY_KEY = "signals-nearby";
const DEFAULT_RADIUS_M = 500;
const OPTIMISTIC_TTL_MS = 45 * 60 * 1000;
const EARTH_RADIUS_M = 6_371_000;
const POINT_REGEX = /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i;

function toPostgisPointExpression(geo: GeoLocation): string {
  // PostGIS ST_Point signature is (x, y) => (lng, lat).
  return `ST_SetSRID(ST_Point(${geo.lng}, ${geo.lat}), 4326)`;
}

function toSignalType(value: string): Signal["type"] {
  switch (value) {
    case "PRESENCE":
    case "SOCIAL_RELAY":
    case "ENVIRONMENTAL":
    case "BEHAVIORAL":
    case "AMBIENT":
    case "EVENT":
      return value;
    default:
      return "PRESENCE";
  }
}

function parsePointLocation(
  location: SignalRow["location"],
  fallback: GeoLocation,
): GeoLocation {
  if (!location) return fallback;

  if (typeof location === "string") {
    const match = POINT_REGEX.exec(location);
    if (!match) return fallback;
    const lng = Number(match[1]);
    const lat = Number(match[2]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return fallback;
    return { lat, lng };
  }

  if (
    typeof location === "object" &&
    location.type === "Point" &&
    Array.isArray(location.coordinates) &&
    location.coordinates.length === 2
  ) {
    const [lng, lat] = location.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return fallback;
}

function haversineDistanceMeters(a: GeoLocation, b: GeoLocation): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_RADIUS_M * y;
}

function mapSignalRow(row: SignalRow, fallbackGeo: GeoLocation): Signal {
  return {
    id: row.id,
    type: toSignalType(row.type),
    venue_id: row.venue_id,
    content: row.content,
    strength: row.strength,
    emitted_at: row.emitted_at,
    expires_at: row.expires_at,
    geo: parsePointLocation(row.location, fallbackGeo),
  };
}

async function insertSignal(payload: SignalCreate): Promise<Signal> {
  // 1. Ensure we have a valid session
  await ensureSupabaseSession();
  const { data: { session } } = await supabase.auth.getSession();

  // 2. Align with your Python 'SignalCreate' Pydantic schema
// Match the Python 'SignalCreate' schema exactly
const body = {
  venue_id: payload.venue_id,
  vibe: payload.vibe || "fire",
  geo: {
    lat: payload.geo.lat,
    lng: payload.geo.lng
  },
  // Fix: Send null if empty, or stringify if it's an object
  content: !payload.content || Object.keys(payload.content).length === 0 
    ? null 
    : typeof payload.content === 'string' 
      ? payload.content 
      : JSON.stringify(payload.content)
};

  // 3. Construct the URL with the mandatory api/v1 prefix
  // We use .replace() to ensure we don't accidentally get double slashes //
  const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
    .replace(/\s+/g, "")
    .replace(/\/+$/, "");
  const finalUrl = `${baseUrl}/api/v1/signals`.replace(/([^:]\/)\/+/g, "$1");

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Logging this to Metro so you can see the exact Python error if it's a 422
    console.error("Signal Post Error:", errorText);
    throw new Error(`Backend Error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  
  // Since your backend returns ApiResponse[SignalResponse], 
  // we need to pass 'result.data' to the mapper
  return mapSignalRow(result.data, payload.geo);
}

export function useNearbySignals(
  lat: number | null,
  lng: number | null,
  radiusM: number = DEFAULT_RADIUS_M,
) {
  return useQuery<Signal[]>({
    queryKey: [SIGNALS_QUERY_KEY, lat, lng, radiusM],
    queryFn: async () => {
      if (lat === null || lng === null) return [];
      const center = { lat, lng };
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from("signals")
        .select("id,type,venue_id,content,strength,emitted_at,expires_at,location")
        .gt("expires_at", nowIso)
        .order("emitted_at", { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? [])
        .map((row) => mapSignalRow(row, center))
        .filter((signal) => haversineDistanceMeters(center, signal.geo) <= radiusM);
    },
    enabled: lat !== null && lng !== null,
  });
}

export function useEmitSignal() {
  const queryClient = useQueryClient();

  return useMutation<
    Signal,
    Error,
    SignalCreate,
    { previous: Array<[readonly unknown[], Signal[] | undefined]>; optimisticId: string }
  >({
    mutationFn: insertSignal,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: [SIGNALS_QUERY_KEY] });

      const previous = queryClient.getQueriesData<Signal[]>({
        queryKey: [SIGNALS_QUERY_KEY],
      });

      const optimisticId = `optimistic-${Date.now().toString(36)}`;
      const nowIso = new Date().toISOString();
      const optimisticSignal: Signal = {
        id: optimisticId,
        type: "PRESENCE",
        venue_id: payload.venue_id ?? null,
        content: payload.content ?? null,
        strength: payload.vibe === "fire" ? 1.0 : payload.vibe === "chill" ? 0.7 : 0.4,
        emitted_at: nowIso,
        expires_at: new Date(Date.now() + OPTIMISTIC_TTL_MS).toISOString(),
        geo: payload.geo,
      };

      for (const [key, existing] of previous) {
        queryClient.setQueryData<Signal[]>(key, [optimisticSignal, ...(existing ?? [])]);
      }

      return { previous, optimisticId };
    },
    onError: (_error, _payload, context) => {
      if (!context) return;
      for (const [key, previousValue] of context.previous) {
        queryClient.setQueryData(key, previousValue);
      }
    },
    onSuccess: (signal, _payload, context) => {
      if (!context) return;
      const entries = queryClient.getQueriesData<Signal[]>({
        queryKey: [SIGNALS_QUERY_KEY],
      });

      for (const [key, existing] of entries) {
        if (!existing) continue;
        queryClient.setQueryData<Signal[]>(
          key,
          existing.map((item) => (item.id === context.optimisticId ? signal : item)),
        );
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: [SIGNALS_QUERY_KEY] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from 'expo-haptics';
import { ensureSupabaseSession, supabase } from "../lib/supabase";
import type { SignalRow } from "../services/supabase/types";
import type { GeoLocation, Signal, SignalCreate } from "../types";

// --- Constants ---
const SIGNALS_QUERY_KEY = "signals-nearby";
const DEFAULT_RADIUS_M = 500;
const OPTIMISTIC_TTL_MS = 45 * 60 * 1000;
const EARTH_RADIUS_M = 6_371_000;
const POINT_REGEX = /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i;
const DEV_BACKEND_FALLBACKS = ["http://127.0.0.1:8000", "http://localhost:8000", "http://10.0.0.145:8000"];

// --- Internal Helpers ---

function toSignalType(value: string): Signal["type"] {
  const types: Signal["type"][] = ["PRESENCE", "SOCIAL_RELAY", "ENVIRONMENTAL", "BEHAVIORAL", "AMBIENT", "EVENT"];
  return types.includes(value as Signal["type"]) ? (value as Signal["type"]) : "PRESENCE";
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

// --- API Logic ---

function normalizeBaseUrl(rawUrl: string | undefined): string {
  return (rawUrl ?? "").trim().replace(/\s+/g, "").replace(/\/+$/, "");
}

function getBackendBaseCandidates(): string[] {
  const configured = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  const ordered = [configured, ...DEV_BACKEND_FALLBACKS].filter((value) => value.length > 0);
  return Array.from(new Set(ordered));
}

function buildLocationExpr(geo: GeoLocation): string {
  // Keep SRID at 4326 for WGS84 coordinates used by PostGIS geography.
  return `ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)::geography`;
}

async function insertSignalDirectlyInSupabase(payload: SignalCreate): Promise<Signal> {
  const trimmedContent = typeof payload.content === "string" ? payload.content.trim() : "";

  const { data, error } = await supabase.rpc("insert_signal_with_location", {
    p_venue_id: payload.venue_id ?? null,
    p_content: trimmedContent.length > 0 ? trimmedContent : null,
    p_vibe: payload.vibe ?? "fire",
    p_location_expr: buildLocationExpr(payload.geo),
  });

  if (error) {
    throw new Error(error.message);
  }

  const first = data?.[0];
  if (!first) {
    throw new Error("Supabase RPC returned no signal row");
  }

  return mapSignalRow(first, payload.geo);
}

async function insertSignal(payload: SignalCreate): Promise<Signal> {
  try {
    await ensureSupabaseSession();
  } catch (error) {
    if (!__DEV__) {
      throw error;
    }
    console.warn("[Signals] ensureSupabaseSession failed in dev, continuing with fallback paths");
  }
  const { data: { session } } = await supabase.auth.getSession();

  const trimmedContent = typeof payload.content === "string" ? payload.content.trim() : "";
  const body = {
    venue_id: payload.venue_id ?? null,
    vibe: payload.vibe ?? "fire",
    geo: { lat: payload.geo.lat, lng: payload.geo.lng },
    content: trimmedContent.length > 0 ? trimmedContent : null,
  };

  const attemptedErrors: string[] = [];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  for (const baseUrl of getBackendBaseCandidates()) {
    const finalUrl = `${baseUrl}/api/v1/signals`.replace(/([^:]\/)\/+/g, "$1");
    try {
      const response = await fetch(finalUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        attemptedErrors.push(`${finalUrl} -> ${response.status}: ${errorText}`);
        continue;
      }

      const result = await response.json();
      return mapSignalRow(result.data, payload.geo);
    } catch (error) {
      attemptedErrors.push(`${finalUrl} -> ${String(error)}`);
    }
  }

  if (__DEV__) {
    try {
      return await insertSignalDirectlyInSupabase(payload);
    } catch (error) {
      attemptedErrors.push(`supabase-rpc -> ${String(error)}`);
    }
  }

  throw new Error(`Signal emission failed: ${attemptedErrors.join(" | ")}`);
}

// --- Hooks ---

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

      if (error) throw new Error(error.message);

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await queryClient.cancelQueries({ queryKey: [SIGNALS_QUERY_KEY] });
      const previous = queryClient.getQueriesData<Signal[]>({ queryKey: [SIGNALS_QUERY_KEY] });
      const optimisticId = `optimistic-${Date.now().toString(36)}`;
      
      const optimisticSignal: Signal = {
        id: optimisticId,
        type: "PRESENCE",
        venue_id: payload.venue_id ?? null,
        content: payload.content ?? null,
        strength: payload.vibe === "fire" ? 1.0 : payload.vibe === "chill" ? 0.7 : 0.4,
        emitted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + OPTIMISTIC_TTL_MS).toISOString(),
        geo: payload.geo,
      };

      for (const [key, existing] of previous) {
        queryClient.setQueryData<Signal[]>(key, [optimisticSignal, ...(existing ?? [])]);
      }
      return { previous, optimisticId };
    },
    onError: (error, _variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!context) return;
      for (const [key, previousValue] of context.previous) {
        queryClient.setQueryData(key, previousValue);
      }
    },
    onSuccess: (signal, _variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!context) return;
      const entries = queryClient.getQueriesData<Signal[]>({ queryKey: [SIGNALS_QUERY_KEY] });
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

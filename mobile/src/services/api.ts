import axios from "axios";
import { useSessionStore } from "../store/useSessionStore";
import { supabase } from "../lib/supabase";
import type {
  ApiResponse,
  DecideRequest,
  DecideResponse,
  EventCreate,
  EventResponse,
  Signal,
  SignalCreate,
  SignalNearbyResponse,
  TrustNetworkResponse,
  User,
  UserUpdate,
  Venue,
} from "../types";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 10_000,
});

// Inject Bearer token on every outgoing request
api.interceptors.request.use((config) => {
  const token = useSessionStore.getState().supabaseSession?.access_token;
  console.log("[HADE API] Sending Token:", token ? `${token.slice(0, 20)}...` : "NULL/UNDEFINED");
  console.log("[HADE API] Request URL:", config.baseURL, config.url);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear auth state and sign out of Supabase
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      supabase.auth.signOut();
      useSessionStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);

// --- Endpoint helpers (typed to match Pydantic schemas) ---

export async function postDecide(
  params: DecideRequest,
): Promise<ApiResponse<DecideResponse>> {
  const { data } = await api.post<ApiResponse<DecideResponse>>("/decide", params);
  return data;
}

export async function postSignal(
  params: SignalCreate,
): Promise<ApiResponse<Signal>> {
  const { data } = await api.post<ApiResponse<Signal>>("/signals", params);
  return data;
}

export async function getNearbySignals(params: {
  lat: number;
  lng: number;
  radius_m?: number;
}): Promise<ApiResponse<SignalNearbyResponse>> {
  const { data } = await api.get<ApiResponse<SignalNearbyResponse>>(
    "/signals/nearby",
    { params: { lat: params.lat, lng: params.lng, radius_m: params.radius_m ?? 500 } },
  );
  return data;
}

export async function getVenue(
  venueId: string,
): Promise<ApiResponse<Venue>> {
  const { data } = await api.get<ApiResponse<Venue>>(`/venues/${venueId}`);
  return data;
}

export async function getMe(): Promise<ApiResponse<User>> {
  const { data } = await api.get<ApiResponse<User>>("/user/me");
  return data;
}

export async function updateMe(
  params: UserUpdate,
): Promise<ApiResponse<User>> {
  const { data } = await api.put<ApiResponse<User>>("/user/me", params);
  return data;
}

export async function getTrustNetwork(): Promise<ApiResponse<TrustNetworkResponse>> {
  const { data } = await api.get<ApiResponse<TrustNetworkResponse>>("/user/trust-network");
  return data;
}

export async function actOnMoment(
  momentId: string,
): Promise<ApiResponse<Record<string, never>>> {
  const { data } = await api.post<ApiResponse<Record<string, never>>>(
    `/moments/${momentId}/act`,
  );
  return data;
}

export async function dismissMoment(
  momentId: string,
): Promise<ApiResponse<Record<string, never>>> {
  const { data } = await api.post<ApiResponse<Record<string, never>>>(
    `/moments/${momentId}/dismiss`,
  );
  return data;
}

export async function postAuthSync(
  params: { username?: string; name?: string },
): Promise<ApiResponse<User>> {
  const { data } = await api.post<ApiResponse<User>>("/auth/sync", params);
  return data;
}

// --- Micro Events ---

export async function postEvent(
  params: EventCreate,
): Promise<ApiResponse<EventResponse>> {
  const { data } = await api.post<ApiResponse<EventResponse>>("/events", params);
  return data;
}

export async function getEvent(
  eventId: string,
): Promise<ApiResponse<EventResponse>> {
  const { data } = await api.get<ApiResponse<EventResponse>>(`/events/${eventId}`);
  return data;
}

export async function expressInterest(
  eventId: string,
): Promise<ApiResponse<EventResponse>> {
  const { data } = await api.post<ApiResponse<EventResponse>>(`/events/${eventId}/in`);
  return data;
}

export async function withdrawInterest(
  eventId: string,
): Promise<ApiResponse<EventResponse>> {
  const { data } = await api.delete<ApiResponse<EventResponse>>(`/events/${eventId}/in`);
  return data;
}

export async function cancelEvent(
  eventId: string,
): Promise<ApiResponse<EventResponse>> {
  const { data } = await api.post<ApiResponse<EventResponse>>(`/events/${eventId}/cancel`);
  return data;
}

export async function endEvent(
  eventId: string,
): Promise<ApiResponse<EventResponse>> {
  const { data } = await api.post<ApiResponse<EventResponse>>(`/events/${eventId}/end`);
  return data;
}

// Raw health check (hits root, not /api/v1)
export async function getHealth(): Promise<{ status: string }> {
  const { data } = await axios.get<{ status: string }>(`${API_BASE}/health`);
  return data;
}

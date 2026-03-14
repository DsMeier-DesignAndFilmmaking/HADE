import axios from "axios";
import { useSessionStore } from "../store/useSessionStore";
import { supabase } from "../lib/supabase";
import type {
  ApiResponse,
  DecideRequest,
  DecideResponse,
  EventCreate,
  EventResponse,
  MomentCreate,
  MomentResponse,
  Signal,
  SignalCreate,
  SignalNearbyResponse,
  TrustNetworkResponse,
  User,
  UserUpdate,
  Venue,
} from "../types";

// 1. Normalize the base URL from the environment
const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.0.145:8000")
  .trim()                    
  .replace(/\s+/g, "")       
  .replace(/\/+$/, "");      

// 2. Ensure /api/v1 is appended correctly
const FINAL_BASE_URL = API_BASE.includes("/api/v1") 
  ? API_BASE 
  : `${API_BASE}/api/v1`;

export const api = axios.create({
  baseURL: FINAL_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Inject Bearer token on every outgoing request
api.interceptors.request.use((config) => {
  const token = useSessionStore.getState().supabaseSession?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoints called DURING the auth setup flow — a 401 here means the backend
// hasn't yet validated the fresh token, not that the user's session is stale.
// Signing out in response to these 401s would destroy the just-issued session.
const AUTO_SIGNOUT_EXEMPT = ["/auth/sync", "/auth/migrate", "/auth/sync-contacts"];

// On 401, clear auth state and sign out — but never during auth setup.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? "";
      const isAuthSetup = AUTO_SIGNOUT_EXEMPT.some((p) => url.includes(p));
      if (!isAuthSetup) {
        supabase.auth.signOut();
        useSessionStore.getState().clearAuth();
      }
    }
    return Promise.reject(error);
  },
);

// --- Auth & Migration Endpoints ---

/**
 * FIX: Explicitly exported for the dynamic import in useAuthStore.ts
 * Hits the FastAPI endpoint to transfer data from guest_id to the new user
 */
export async function migrateGuestSession(guestId: string): Promise<ApiResponse<User>> {
  const { data } = await api.post<ApiResponse<User>>("/auth/migrate", { 
    guest_id: guestId 
  });
  return data;
}

export async function postAuthSync(
  params: { username?: string; name?: string },
): Promise<ApiResponse<User>> {
  const { data } = await api.post<ApiResponse<User>>("/auth/sync", params);
  return data;
}

export async function syncContacts(
  phoneHashes: string[],
): Promise<ApiResponse<{ edges_created: number; edges_mutual: number }>> {
  const { data } = await api.post<
    ApiResponse<{ edges_created: number; edges_mutual: number }>
  >("/auth/sync-contacts", { phone_hashes: phoneHashes });
  return data;
}

// --- Spontaneity Engine Endpoints ---

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

export async function postMoment(
  params: MomentCreate,
): Promise<ApiResponse<MomentResponse>> {
  const { data } = await api.post<ApiResponse<MomentResponse>>("/moments", params);
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

// --- User & Social Endpoints ---

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

// --- Health Check ---
export async function getHealth(): Promise<{ status: string }> {
  const { data } = await axios.get<{ status: string }>(`${API_BASE}/health`);
  return data;
}
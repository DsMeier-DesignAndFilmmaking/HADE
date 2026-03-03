/** Shared TypeScript types for HADE mobile app. */

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  username: string | null;
  name: string;
  home_city: string;
  onboarding_complete: boolean;
  created_at: string;
  last_active: string;
}

export type SignalType =
  | "PRESENCE"
  | "SOCIAL_RELAY"
  | "ENVIRONMENTAL"
  | "BEHAVIORAL"
  | "AMBIENT";

export interface Signal {
  id: string;
  type: SignalType;
  venue_id: string | null;
  content: string | null;
  strength: number;
  emitted_at: string;
  expires_at: string;
  geo: GeoLocation;
}

export interface Venue {
  id: string;
  name: string;
  category: string;
  geo: GeoLocation;
  address: string;
  price_tier: number;
  is_open_now: boolean;
  live_busyness: number | null;
  last_signal_at: string | null;
}

export interface TrustAttribution {
  user_name: string;
  signal_summary: string;
}

export interface Opportunity {
  id: string;
  venue_name: string;
  category: string;
  distance_meters: number;
  eta_minutes: number;
  rationale: string;
  trust_attributions: TrustAttribution[];
  geo: GeoLocation;
  is_primary: boolean;
}

export interface DecideResponse {
  primary: Opportunity;
  fallbacks: Opportunity[];
  context_state_id: string;
}

export type Intent = "eat" | "drink" | "chill" | "scene" | "anything";

export type DayType = "WEEKDAY" | "WEEKEND" | "HOLIDAY";
export type EnergyLevel = "LOW" | "MODERATE" | "HIGH";

export interface SocialEdge {
  user_id: string;
  user_name: string;
  edge_weight: number;
  last_interaction: string;
}

export interface ApiResponse<T> {
  status: "ok" | "error";
  data: T | null;
  meta: {
    request_id: string;
    latency_ms?: number;
    context_state_id?: string;
  } | null;
  errors: { code: string; message: string; detail?: string }[];
}

// --- Request types (match Pydantic request schemas) ---

export interface DecideRequest {
  geo: GeoLocation;
  intent?: string | null;
  group_size?: number;
  session_id?: string | null;
}

export interface SignalCreate {
  venue_id?: string | null;
  content?: string | null;
  geo: GeoLocation;
}

export interface UserUpdate {
  name?: string | null;
  home_city?: string | null;
}

// --- Response types (match Pydantic response schemas) ---

export interface SignalNearbyResponse {
  signals: Signal[];
}

export interface TrustNetworkResponse {
  edges: SocialEdge[];
}

export interface WeatherState {
  condition: string;
  temp: number;
  precip_probability: number;
}

export interface ContextStateResponse {
  id: string;
  user_id: string;
  timestamp: string;
  geo: GeoLocation;
  time_of_day: string;
  day_type: DayType;
  weather: WeatherState | null;
  group_size: number;
  intent_declared: string | null;
  energy_inferred: EnergyLevel;
  session_id: string;
}

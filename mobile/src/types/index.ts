/** Shared TypeScript types for HADE mobile app. */

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  username: string | null;
  name: string;
  email: string | null;
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
  | "AMBIENT"
  | "EVENT";

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
  vibe_label?: string;
}

export interface PrimarySignal {
  user_name: string;
  timestamp: string;   // ISO 8601
  vibe_label: string;  // "Busy/Great" | "Chill" | "Avoid"
  comment: string;
}

export type SignalVibe = "fire" | "chill" | "avoid";

export interface EventInfo {
  event_id: string;
  title: string;
  host_name: string;
  starts_at: string;
  expires_at: string;
  interest_count_hint: string | null;
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
  event: EventInfo | null;
  primary_signal: PrimarySignal | null;
}

export interface DecideResponse {
  primary: Opportunity;
  fallbacks: Opportunity[];
  context_state_id: string;
  provider?: string;
}

export type MomentAction = "ACCEPTED" | "DISMISSED" | "IGNORED";

export interface MomentCreate {
  context_state_id: string;
  opportunity_id: string;
  action: MomentAction;
  venue_id?: string | null;
}

export interface MomentResponse {
  id: string;
  context_state_id: string;
  opportunity_id: string;
  action: MomentAction;
  acted_on: boolean;
  dismissed: boolean;
  acted_at: string | null;
  surfaced_at: string;
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
  provider?: "gemini" | "openai";
}

export interface SignalCreate {
  venue_id?: string | null;
  content?: string | null;
  geo: GeoLocation;
  vibe?: SignalVibe;
}

export interface UserUpdate {
  name?: string;           // Removed | null to fix TS(2345)
  home_city?: string;      // Removed | null
  username?: string;       // Added for Auth/Bypass
  onboarding_complete?: boolean; // Added for Onboarding flow
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

// --- Micro Events ---

export type EventVisibility = "TRUST_NETWORK" | "EXTENDED" | "OPEN";
export type EventStatus = "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";

export interface EventCreate {
  title: string;
  note?: string | null;
  category: string;
  venue_id?: string | null;
  geo: GeoLocation;
  address?: string | null;
  starts_at?: string | null;
  duration_minutes?: number;
  visibility?: EventVisibility;
}

export interface EventResponse {
  id: string;
  host_name: string;
  host_username: string | null;
  title: string;
  note: string | null;
  category: string;
  venue_name: string | null;
  geo: GeoLocation;
  address: string | null;
  starts_at: string;
  expires_at: string;
  status: EventStatus;
  visibility: EventVisibility;
  is_interested: boolean;
  friend_interest_hint: string | null;
}

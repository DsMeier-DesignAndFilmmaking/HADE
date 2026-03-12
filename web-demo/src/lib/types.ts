/** Shared TypeScript types for HADE web demo — copied from mobile/src/types/index.ts */

export interface GeoLocation {
  lat: number;
  lng: number;
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
  timestamp: string;
  vibe_label: string;
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
  neighborhood?: string;
}

export interface DecideResponse {
  primary: Opportunity;
  fallbacks: Opportunity[];
  context_state_id: string;
  provider?: string;
}

export type Intent = "eat" | "drink" | "chill" | "scene" | "anything";

export type DayType = "WEEKDAY" | "WEEKEND" | "HOLIDAY";
export type EnergyLevel = "LOW" | "MODERATE" | "HIGH";

export interface WeatherState {
  condition: string;
  temp: number;
  precip_probability: number;
}

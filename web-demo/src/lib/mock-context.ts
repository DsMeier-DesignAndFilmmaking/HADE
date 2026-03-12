/** Simulated context state for the Friday evening Denver demo scenario. */

export const MOCK_CONTEXT = {
  timestamp: "Friday, 9:14 PM",
  time_of_day: "EVENING",
  day_type: "WEEKEND" as const,
  weather: { condition: "Clear", temp: 62, precip_probability: 0.05 },
  geo: { lat: 39.7541, lng: -104.9998 },
  energy_inferred: "MODERATE" as const,
  group_size: 1,
  city: "Denver, CO",
};

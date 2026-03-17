/** Dynamic context builder for the HADE web demo. */

type DayType = "WEEKEND" | "WEEKDAY";
type EnergyLevel = "LOW" | "MODERATE" | "HIGH";
type TimeOfDay = "MORNING" | "AFTERNOON" | "EVENING" | "LATE_NIGHT";

export interface MockContext {
  timestamp: string;
  time_of_day: TimeOfDay;
  day_type: DayType;
  weather: { condition: string; temp: number; precip_probability: number };
  geo: { lat: number; lng: number };
  energy_inferred: EnergyLevel;
  group_size: number;
  city: string;
}

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 22) return "EVENING";
  return "LATE_NIGHT";
}

function getDayType(day: number): DayType {
  // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6 ? "WEEKEND" : "WEEKDAY";
}

/**
 * Builds a live context snapshot from the user's real coordinates.
 * Weather is kept static for the demo (no API key required).
 * City is kept generic — a reverse geocode call would be needed to resolve it.
 */
export function buildMockContext(geo: { lat: number; lng: number }): MockContext {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  const timestamp = now.toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return {
    timestamp,
    time_of_day: getTimeOfDay(hour),
    day_type: getDayType(day),
    // Static weather — replace with OpenWeatherMap call when API key is available
    weather: { condition: "Clear", temp: 62, precip_probability: 0.05 },
    geo,
    energy_inferred: hour >= 20 ? "HIGH" : "MODERATE",
    group_size: 1,
    // Resolved to a real city name via reverse geocode in the production backend.
    // Web demo uses "Your Location" until that integration is wired.
    city: "Your Location",
  };
}

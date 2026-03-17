/**
 * HADE Agentic Content Generator
 *
 * Hits the real backend /api/v1/decide endpoint to get a live, location-aware
 * recommendation. Falls back gracefully to null on any error so callers can
 * degrade to mockDecide().
 */
import type { DecideResponse, Intent } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "";

// Pre-issued dev JWT (HS256, signed with JWT_SECRET on the Railway backend).
// Set NEXT_PUBLIC_DEMO_TOKEN in Vercel environment variables.
const DEMO_TOKEN =
  process.env.NEXT_PUBLIC_DEMO_TOKEN ?? "";

/**
 * Calls the real HADE backend to generate an agentic recommendation.
 * Returns null on any network/API error — caller is responsible for fallback.
 */
export async function generateAgenticContent(
  lat: number,
  lng: number,
  intent: Intent
): Promise<DecideResponse | null> {
  if (!API_BASE) {
    console.warn(
      "%cHADE: NEXT_PUBLIC_API_URL not set — agentic generation unavailable",
      "color: #F59E0B; font-weight: bold;"
    );
    return null;
  }

  if (!DEMO_TOKEN) {
    console.warn(
      "%cHADE: NEXT_PUBLIC_DEMO_TOKEN not set — request will be rejected with 401",
      "color: #EF4444; font-weight: bold;"
    );
  }

  console.log("[HADE] Auth Header Present:", !!DEMO_TOKEN);

  try {
    const res = await fetch(`${API_BASE}/api/v1/decide`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(DEMO_TOKEN ? { Authorization: `Bearer ${DEMO_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        geo: { lat, lng },
        intent,
        group_size: 1,
        provider: "gemini",
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      console.warn(
        `%cHADE: /api/v1/decide returned ${res.status} — falling back to mock`,
        "color: #F59E0B; font-weight: bold;"
      );
      return null;
    }

    const data: DecideResponse = await res.json();

    console.log(
      "%cHADE: Agentic Playbook Successfully Generated",
      "color: #22C55E; font-weight: bold;",
      `for (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    );

    return data;
  } catch (e) {
    console.warn(
      "%cHADE: Agentic generation failed — falling back to mock",
      "color: #F59E0B; font-weight: bold;",
      e
    );
    return null;
  }
}

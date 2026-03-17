"""Google Places API integration — venue discovery for the /decide pipeline.

Queries Google Places Nearby Search to find real venues near the user,
then normalizes results into a format the scoring system can consume.
Includes in-memory TTL cache to stay under API rate limits.
"""

import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import settings

# ─── Intent → Google Places type mapping ─────────────────────────────────────
# Maps HADE intents to Google Places `type` parameter values.
# "anything" triggers a broad multi-type search.
INTENT_TYPE_MAP: dict[str, list[str]] = {
    "eat": ["restaurant"],
    "drink": ["bar", "cafe"],
    "chill": ["cafe", "park"],
    "scene": ["night_club", "bar"],
    "anything": ["restaurant", "bar", "cafe", "night_club"],
}

# Google Places Nearby Search endpoint
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"


# ─── Normalized venue result ─────────────────────────────────────────────────
@dataclass
class PlaceResult:
    """Normalized venue from Google Places API."""

    place_id: str
    name: str
    category: str  # Best human-readable type
    lat: float
    lng: float
    rating: float
    price_level: int  # 0-4
    open_now: bool
    vicinity: str  # Address / neighborhood
    types: list[str]  # Raw Google types


# ─── In-memory TTL cache ─────────────────────────────────────────────────────
@dataclass
class _CacheEntry:
    results: list[PlaceResult]
    expires_at: float


_cache: dict[str, _CacheEntry] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


def _cache_key(lat: float, lng: float, intent: str, radius_m: int) -> str:
    """Round lat/lng to ~100m precision for cache grouping."""
    return f"{round(lat, 3)}:{round(lng, 3)}:{intent}:{radius_m}"


def _get_cached(key: str) -> list[PlaceResult] | None:
    entry = _cache.get(key)
    if entry and entry.expires_at > time.time():
        return entry.results
    if entry:
        del _cache[key]
    return None


def _set_cached(key: str, results: list[PlaceResult]) -> None:
    _cache[key] = _CacheEntry(results=results, expires_at=time.time() + _CACHE_TTL_SECONDS)


# ─── Type → human-readable category ─────────────────────────────────────────
_TYPE_LABELS: dict[str, str] = {
    "restaurant": "Restaurant",
    "bar": "Bar",
    "cafe": "Café",
    "night_club": "Nightlife",
    "park": "Park",
    "bakery": "Bakery",
    "meal_delivery": "Restaurant",
    "meal_takeaway": "Takeaway",
}


def _best_category(types: list[str]) -> str:
    """Pick the most descriptive human-readable category from Google types."""
    for t in types:
        if t in _TYPE_LABELS:
            return _TYPE_LABELS[t]
    return "Spot"


# ─── Core API function ───────────────────────────────────────────────────────
async def search_nearby(
    lat: float,
    lng: float,
    intent: str | None = None,
    radius_m: int = 1000,
) -> list[PlaceResult]:
    """Search Google Places for venues near the given coordinates.

    Args:
        lat: Latitude
        lng: Longitude
        intent: HADE intent ("eat", "drink", "chill", "scene", "anything", or None)
        radius_m: Search radius in meters (default 1000)

    Returns:
        List of normalized PlaceResult objects, deduplicated by place_id.
    """
    resolved_intent = intent or "anything"
    place_types = INTENT_TYPE_MAP.get(resolved_intent, INTENT_TYPE_MAP["anything"])

    # Check cache
    cache_key = _cache_key(lat, lng, resolved_intent, radius_m)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    api_key = settings.google_places_api_key
    if not api_key:
        # Log clearly so Railway logs surface the missing key, but return an
        # empty list rather than crashing — the /decide pipeline will return
        # an honest "nothing great right now" empty state instead of a 500.
        import logging as _logging
        _logging.getLogger(__name__).error(
            "[HADE] GOOGLE_PLACES_API_KEY is not set in Railway env vars. "
            "Add it to get real venue results. Returning empty venue list."
        )
        return []

    # Query each type and merge (Google only accepts one type per request)
    all_results: dict[str, PlaceResult] = {}

    async with httpx.AsyncClient(timeout=10.0) as client:
        for place_type in place_types:
            params: dict[str, Any] = {
                "location": f"{lat},{lng}",
                "radius": radius_m,
                "type": place_type,
                "key": api_key,
            }

            resp = await client.get(PLACES_NEARBY_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                error_msg = data.get("error_message", data.get("status", "Unknown error"))
                raise RuntimeError(f"Google Places API error: {error_msg}")

            for place in data.get("results", []):
                pid = place["place_id"]
                if pid in all_results:
                    continue  # Deduplicate across type queries

                # Extract opening hours
                opening = place.get("opening_hours", {})
                is_open = opening.get("open_now", False)

                all_results[pid] = PlaceResult(
                    place_id=pid,
                    name=place.get("name", "Unknown"),
                    category=_best_category(place.get("types", [])),
                    lat=place["geometry"]["location"]["lat"],
                    lng=place["geometry"]["location"]["lng"],
                    rating=place.get("rating", 0.0),
                    price_level=place.get("price_level", 0),
                    open_now=is_open,
                    vicinity=place.get("vicinity", ""),
                    types=place.get("types", []),
                )

    results = list(all_results.values())

    # Cache the merged results
    _set_cached(cache_key, results)

    return results

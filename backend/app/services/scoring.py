"""Layer 4: Scoring System — produces scored candidates from Google Places + signals.

MVP scoring formula:
  base_score = 1.0 - (distance / radius)           # Closer = better
  + open_bonus (0.3 if open now)
  + category_bonus (0.2 if intent matches)
  + rating_bonus ((rating - 3.0) * 0.1)
  * (1 + signal_boost)                             # Signals from check-ins
  * trust_boost                                     # Friend signals multiply

Confidence floor applies — venues scoring below 0.3 are dropped.
Empty list is a valid response ("Nothing great right now").

EVENT signals (Phase 2) will receive additional scoring adjustments:
- Temporal urgency bonus: events within 30 min of starts_at get a boost
- Intent matching: event category matched against context.intent_declared
- Social proof multiplier: friend interest count > 0 boosts score (capped)
- Freshness: recently created events score higher than older active ones
"""

import math
from dataclasses import dataclass, field
from uuid import UUID

from app.models.context_state import ContextState
from app.models.signal import Signal
from app.services.google_places import PlaceResult

# Confidence floor: opportunities below this score are not surfaced
CONFIDENCE_FLOOR = 0.3

# Phase 2 constants (preserved for later)
EVENT_URGENCY_WINDOW_MINUTES = 30
EVENT_URGENCY_BOOST = 1.5
INTENT_MATCH_BONUS = 1.3


def _haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in meters between two lat/lng points."""
    R = 6_371_000  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _eta_from_distance(distance_m: float) -> int:
    """Estimate walking time in minutes from distance in meters."""
    # Average walking speed: ~80 meters per minute (4.8 km/h)
    return max(1, round(distance_m / 80))


def _intent_matches_types(intent: str | None, types: list[str]) -> bool:
    """Check if the user's intent matches the Google Places types."""
    if not intent or intent == "anything":
        return False  # No bonus for broad intent
    intent_to_types: dict[str, set[str]] = {
        "eat": {"restaurant", "bakery", "meal_delivery", "meal_takeaway"},
        "drink": {"bar", "cafe", "night_club"},
        "chill": {"cafe", "park", "library"},
        "scene": {"night_club", "bar"},
    }
    target_types = intent_to_types.get(intent, set())
    return bool(target_types & set(types))


# ─── Scored candidate (intermediate result) ──────────────────────────────────
@dataclass
class ScoredCandidate:
    """A venue candidate with its computed score and metadata."""

    place: PlaceResult
    score: float
    distance_m: float
    eta_minutes: int
    matched_signals: list[Signal] = field(default_factory=list)
    has_friend_signal: bool = False


def score_candidates(
    places: list[PlaceResult],
    signals: list[Signal],
    trust_weights: dict[UUID, float],
    context: ContextState,
    user_lat: float,
    user_lng: float,
    radius_m: int = 1000,
) -> list[ScoredCandidate]:
    """Score Google Places results, boosted by nearby signals and trust weights.

    Trust signals multiply, not add. Confidence floor enforced.

    Returns scored candidates above the confidence floor, sorted descending.
    Returns empty list if nothing is strong enough — this is valid.
    """
    candidates: list[ScoredCandidate] = []

    for place in places:
        # ── Distance scoring ──
        distance_m = _haversine_distance(user_lat, user_lng, place.lat, place.lng)
        eta_minutes = _eta_from_distance(distance_m)

        # Base score: closer is better (linear decay over search radius)
        base_score = max(0.05, 1.0 - (distance_m / radius_m))

        # ── Bonuses ──
        open_bonus = 0.3 if place.open_now else 0.0
        category_bonus = 0.2 if _intent_matches_types(context.intent_declared, place.types) else 0.0
        rating_bonus = max(0.0, (place.rating - 3.0) * 0.1) if place.rating > 0 else 0.0

        # ── Signal matching ──
        # Find signals near this specific venue (within 100m)
        matched_signals: list[Signal] = []
        signal_boost = 0.0
        has_friend_signal = False

        for sig in signals:
            # We can't easily extract lat/lng from PostGIS in Python without DB,
            # so for MVP we associate all nearby signals (already radius-filtered
            # by the aggregator) with a proximity weight based on venue distance.
            # Phase 2 will match by venue_id / external_id.
            sig_contribution = sig.strength * 0.3
            signal_boost += sig_contribution
            matched_signals.append(sig)

            trust_mult = trust_weights.get(sig.id, 1.0)
            if trust_mult > 1.0:
                has_friend_signal = True

        # ── Trust boost (multiply, not add) ──
        trust_boost = 2.0 if has_friend_signal else 1.0

        # ── Final score ──
        raw_score = base_score + open_bonus + category_bonus + rating_bonus
        final_score = raw_score * (1.0 + signal_boost) * trust_boost

        # Apply confidence floor
        if final_score < CONFIDENCE_FLOOR:
            continue

        candidates.append(
            ScoredCandidate(
                place=place,
                score=final_score,
                distance_m=distance_m,
                eta_minutes=eta_minutes,
                matched_signals=matched_signals,
                has_friend_signal=has_friend_signal,
            )
        )

    # Sort by score descending
    candidates.sort(key=lambda c: c.score, reverse=True)

    return candidates

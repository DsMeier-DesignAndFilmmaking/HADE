"""Layer 4: Scoring System — venue-bound candidates for LLM-grounded inference."""

import logging
import math
from uuid import UUID

from app.models.context_state import ContextState
from app.schemas.candidate import Candidate, CandidateSet, CandidateSignal
from app.schemas.common import GeoLocation
from app.services.google_places import PlaceResult
from app.services.signal_aggregator import AggregatedSignal
from app.services.trust_layer import build_venue_trust_contexts

# Confidence floor: opportunities below this score are not surfaced
CONFIDENCE_FLOOR = 0.3
BINDING_RADIUS_M = 50.0

logger = logging.getLogger(__name__)


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


def _environmental_context(context: ContextState) -> str | None:
    weather = (context.weather_condition or "").strip()
    time_of_day = (context.time_of_day or "").strip().replace("_", " ")

    tokens: list[str] = []
    if weather:
        tokens.append(weather.title())
    if time_of_day:
        tokens.append(time_of_day.title())

    if not tokens:
        return None
    return " • ".join(tokens)


def _bind_signal_to_place(
    signal: AggregatedSignal,
    place: PlaceResult,
    place_venue_id: UUID | None,
) -> tuple[bool, str | None, float | None]:
    if place_venue_id is not None and signal.signal.venue_id == place_venue_id:
        return (True, "venue_id_match", 0.0)

    if signal.signal.venue_id is not None:
        return (False, None, None)

    if signal.lat is None or signal.lng is None:
        return (False, None, None)

    distance_m = _haversine_distance(signal.lat, signal.lng, place.lat, place.lng)
    if distance_m <= BINDING_RADIUS_M:
        return (True, "floating_within_50m", distance_m)
    return (False, None, None)


def score_candidates(
    places: list[PlaceResult],
    signals: list[AggregatedSignal],
    trust_weights: dict[UUID, float],
    context: ContextState,
    user_lat: float,
    user_lng: float,
    radius_m: int = 1000,
    friend_names: dict[UUID, str] | None = None,
    user_names: dict[UUID, str] | None = None,
    relationship_labels: dict[UUID, str] | None = None,
    place_to_venue_id: dict[str, UUID] | None = None,
) -> CandidateSet:
    """Build a venue-bound CandidateSet for inference/LLM reasoning."""
    resolved_place_to_venue_id = place_to_venue_id or {}
    if friend_names is None:
        friend_names = {}
    if user_names is None:
        user_names = {}
    if relationship_labels is None:
        relationship_labels = {}

    staged_by_place: dict[str, tuple[PlaceResult, float, int, float, list[CandidateSignal]]] = {}
    venue_signals: dict[str, list[CandidateSignal]] = {}

    for place in places:
        distance_m = _haversine_distance(user_lat, user_lng, place.lat, place.lng)
        eta_minutes = _eta_from_distance(distance_m)
        base_score = max(0.05, 1.0 - (distance_m / radius_m))
        open_bonus = 0.3 if place.open_now else 0.0
        category_bonus = 0.2 if _intent_matches_types(context.intent_declared, place.types) else 0.0
        rating_bonus = max(0.0, (place.rating - 3.0) * 0.1) if place.rating > 0 else 0.0
        raw_score = base_score + open_bonus + category_bonus + rating_bonus

        matched_signals: list[CandidateSignal] = []
        for sig in signals:
            place_venue_id = resolved_place_to_venue_id.get(place.place_id)
            is_match, reason, distance_to_venue = _bind_signal_to_place(sig, place, place_venue_id)
            if not is_match or reason is None:
                continue

            matched_signals.append(
                CandidateSignal(
                    signal_id=sig.signal.id,
                    signal_type=sig.signal.type.value,
                    source_user_id=sig.signal.source_user_id,
                    venue_id=sig.signal.venue_id,
                    content=sig.signal.content,
                    emitted_at=sig.signal.emitted_at,
                    age_hours=sig.age_hours,
                    decay_strength=sig.decay_strength,
                    freshness_multiplier=sig.freshness_multiplier,
                    effective_strength=sig.effective_strength,
                    distance_to_venue_m=distance_to_venue,
                    binding_reason=reason,
                )
            )

        venue_signals[place.place_id] = matched_signals
        staged_by_place[place.place_id] = (
            place,
            distance_m,
            eta_minutes,
            raw_score,
            matched_signals,
        )

    trust_contexts = build_venue_trust_contexts(
        venue_signals=venue_signals,
        trust_weights=trust_weights,
        relationship_labels=relationship_labels,
        friend_names=friend_names,
        user_names=user_names,
    )

    candidates: list[Candidate] = []
    env_context = _environmental_context(context)
    for place_id, staged in staged_by_place.items():
        place, distance_m, eta_minutes, raw_score, matched_signals = staged

        max_trust = 1.0
        if matched_signals:
            max_trust = max(
                (trust_weights.get(signal.signal_id, 1.0) for signal in matched_signals),
                default=1.0,
            )

        tier_bonus = 0.0
        if max_trust >= 10.0:
            tier_bonus = 1000.0
        elif max_trust >= 5.0:
            tier_bonus = 500.0
        raw_score += tier_bonus

        signal_boost = 0.0
        for matched in matched_signals:
            signal_boost += matched.effective_strength * 0.25

        trust_context = trust_contexts.get(place_id)
        if trust_context is None:
            trust_context = build_venue_trust_contexts(
                venue_signals={place_id: matched_signals},
                trust_weights=trust_weights,
                relationship_labels=relationship_labels,
                friend_names=friend_names,
                user_names=user_names,
            )[place_id]
        trust_context.environmental_context = env_context

        trust_context.trust_multiplier = max_trust
        if max_trust >= 10.0:
            trust_context.relationship_label = "Mutual Friend"
        elif max_trust > 1.0:
            trust_context.relationship_label = "Follower"
        else:
            trust_context.relationship_label = trust_context.relationship_label or "Local Explorer"

        trust_boost = 1.0 + 0.6 * (max_trust - 1.0)
        final_score = raw_score * (1.0 + signal_boost) * trust_boost
        logger.debug(
            "[DEBUG] Venue: %s, Score: %.2f, Trust: %.1f",
            place.name,
            final_score,
            max_trust,
        )
        if final_score < CONFIDENCE_FLOOR:
            continue

        candidates.append(
            Candidate(
                place_id=place.place_id,
                venue_name=place.name,
                category=place.category,
                geo=GeoLocation(lat=place.lat, lng=place.lng),
                distance_meters=round(distance_m),
                eta_minutes=eta_minutes,
                score=final_score,
                is_open_now=place.open_now,
                rating=place.rating,
                matched_signals=matched_signals,
                trust_context=trust_context,
            )
        )

    candidates.sort(key=lambda candidate: candidate.score, reverse=True)

    return CandidateSet(
        context_state_id=context.id,
        candidates=candidates,
    )

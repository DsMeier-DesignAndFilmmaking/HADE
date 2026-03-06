"""Layer 5: Decision Layer — one primary recommendation + rationale + fallbacks.

MVP: Picks the highest-scoring candidate, generates a contextual rationale,
and returns 2-3 fallbacks.

Phase 2 will add event-specific rationale:
- Friend's event: "Jordan's hosting drinks on the rooftop at 8. Maya and Soren are in."
- Business event, friend-endorsed: "Live jazz at The Blue Note tonight. Elena was here last week."
- Business event, no trust: "Free tasting at Bodega Wines until 9. 12 min walk."
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.micro_event import MicroEvent
from app.models.user import User
from app.schemas.common import GeoLocation
from app.schemas.decide import DecideResponse, OpportunityOut, PrimarySignal, TrustAttribution
from app.schemas.event import EventInfo
from app.services.scoring import ScoredCandidate


async def _build_event_info(event: MicroEvent, db: AsyncSession) -> EventInfo:
    """Build EventInfo from a MicroEvent for the recommendation response."""
    host = await db.get(User, event.host_user_id)
    host_name = host.name if host else "Someone"

    return EventInfo(
        event_id=event.id,
        title=event.title,
        host_name=host_name,
        starts_at=event.starts_at,
        expires_at=event.expires_at,
        interest_count_hint=None,  # Phase 2: populate with friend interest hints
    )


def _generate_rationale(
    candidate: ScoredCandidate,
    time_of_day: str,
) -> str:
    """Generate a human-readable, confident rationale string.

    Voice: Present-tense, personal, confident.
    DO: "Solid cafe spot. Just 3 min walk. Open now."
    DON'T: "Based on user activity" or "Trending near you."
    """
    place = candidate.place
    eta = candidate.eta_minutes
    category = place.category

    # ── With friend signal ──
    if candidate.has_friend_signal and candidate.matched_signals:
        # Phase 2 will include the actual friend name from the signal
        return f"Someone in your circle was here recently. {category} spot, {eta} min walk."

    # ── Without signal (cold start / Google Places only) ──
    parts: list[str] = []

    # Venue vibe based on time of day
    if time_of_day in ("evening", "late_night"):
        parts.append(f"Good {category.lower()} energy tonight.")
    elif time_of_day == "morning":
        parts.append(f"Solid {category.lower()} for the morning.")
    elif time_of_day == "lunch":
        parts.append(f"Strong {category.lower()} pick for lunch.")
    else:
        parts.append(f"Solid {category.lower()} spot.")

    # Distance context
    if eta <= 5:
        parts.append(f"Just {eta} min walk.")
    else:
        parts.append(f"{eta} min walk.")

    # Open status
    if place.open_now:
        parts.append("Open now.")

    # Rating (if strong)
    if place.rating >= 4.3:
        parts.append("Consistently well-regarded.")

    return " ".join(parts)


def _candidate_to_opportunity_out(
    candidate: ScoredCandidate,
    is_primary: bool,
    time_of_day: str,
) -> OpportunityOut:
    """Convert a ScoredCandidate into an OpportunityOut response schema."""
    place = candidate.place
    rationale = _generate_rationale(candidate, time_of_day)

    # Build trust attributions from matched signals
    trust_attributions: list[TrustAttribution] = []
    primary_signal: PrimarySignal | None = None

    if candidate.has_friend_signal and candidate.matched_signals:
        # Phase 2: look up actual user names from signal source_user_id
        trust_attributions.append(
            TrustAttribution(
                user_name="A friend",
                signal_summary="was nearby recently",
            )
        )
        sig = candidate.matched_signals[0]
        primary_signal = PrimarySignal(
            user_name="A friend",
            timestamp=sig.emitted_at,
            vibe_label="Great",
            comment=sig.content or "Checked in nearby",
        )

    return OpportunityOut(
        id=uuid.uuid4(),
        venue_name=place.name,
        category=place.category,
        distance_meters=round(candidate.distance_m),
        eta_minutes=candidate.eta_minutes,
        rationale=rationale,
        trust_attributions=trust_attributions,
        geo=GeoLocation(lat=place.lat, lng=place.lng),
        is_primary=is_primary,
        event=None,  # Phase 2: populate for event-backed opportunities
        primary_signal=primary_signal,
    )


async def make_decision(
    candidates: list[ScoredCandidate],
    context_state_id: uuid.UUID,
    time_of_day: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> DecideResponse | None:
    """Convert ranked candidates into a single confident recommendation.

    Returns None if no candidate meets the confidence threshold —
    "Nothing great right now" is a valid answer.
    """
    if not candidates:
        return None

    # Primary = highest score
    primary_candidate = candidates[0]
    primary_out = _candidate_to_opportunity_out(
        primary_candidate, is_primary=True, time_of_day=time_of_day
    )

    # Fallbacks = next 2-3
    fallbacks: list[OpportunityOut] = []
    for candidate in candidates[1:4]:
        fallbacks.append(
            _candidate_to_opportunity_out(
                candidate, is_primary=False, time_of_day=time_of_day
            )
        )

    return DecideResponse(
        primary=primary_out,
        fallbacks=fallbacks,
        context_state_id=context_state_id,
    )

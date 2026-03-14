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

from app.schemas.candidate import Candidate, CandidateSet
from app.models.micro_event import MicroEvent
from app.models.user import User
from app.schemas.decide import DecideResponse, OpportunityOut, PrimarySignal, TrustAttribution
from app.schemas.event import EventInfo


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


def _format_time_ago(emitted_at: datetime) -> str:
    """Format signal timestamp as human-readable relative time."""
    now = datetime.now(timezone.utc)
    delta = now - emitted_at
    minutes = int(delta.total_seconds() / 60)
    if minutes < 5:
        return "just now"
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    return f"{days}d ago"


def _vibe_label_from_strength(strength: float) -> str:
    """Reverse-map signal strength to a human vibe label."""
    if strength >= 1.2:
        return "High Energy"
    if strength >= 0.8:
        return "Solid Spot"
    return "Calm"


def _relationship_label(is_mutual_friend: bool) -> str:
    return "Mutual Friend" if is_mutual_friend else "Local Explorer"


def _generate_rationale(
    candidate: Candidate,
    time_of_day: str,
) -> str:
    """Generate a human-readable, confident rationale string.

    Voice: Present-tense, personal, confident.
    DO: 'Alex, 2h ago: "the miso ramen."'
    DON'T: "Based on user activity" or "Trending near you."
    """
    eta = candidate.eta_minutes
    category = candidate.category

    # ── With friend signal ──
    if candidate.trust_context.is_friend_checkin and candidate.matched_signals:
        sig = max(candidate.matched_signals, key=lambda item: item.effective_strength)
        bundle = candidate.trust_context.signal_bundle
        name = (
            bundle.user_first_name
            if bundle and bundle.user_first_name
            else candidate.trust_context.operator_name
            or candidate.trust_context.friend_name
            or "A friend"
        )
        time_ago = _format_time_ago(sig.emitted_at)

        # Verbatim quote when content exists
        if candidate.trust_context.signal_text:
            return f'{name}, {time_ago}: "{candidate.trust_context.signal_text}"'
        interaction = candidate.trust_context.interaction_type or "LIVE_SIGNAL"
        if (
            (candidate.trust_context.relationship_label == "Mutual Friend")
            and candidate.distance_meters >= 2000
        ):
            return f"It's a longer trip ({eta} min away), but {name} is there."
        return f"{name} {interaction.lower()} {time_ago}. {category} spot, {eta} min walk."

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
    if candidate.is_open_now:
        parts.append("Open now.")

    # Rating (if strong)
    if candidate.rating >= 4.3:
        parts.append("Consistently well-regarded.")

    return " ".join(parts)


def _candidate_to_opportunity_out(
    candidate: Candidate,
    is_primary: bool,
    time_of_day: str,
) -> OpportunityOut:
    """Convert a Candidate into an OpportunityOut response schema."""
    rationale = _generate_rationale(candidate, time_of_day)

    # Build trust attributions from matched signals
    trust_attributions: list[TrustAttribution] = []
    primary_signal: PrimarySignal | None = None

    if candidate.matched_signals:
        sig = max(candidate.matched_signals, key=lambda item: item.effective_strength)
        bundle = candidate.trust_context.signal_bundle
        name = (
            bundle.user_first_name
            if bundle and bundle.user_first_name
            else candidate.trust_context.operator_name
            or candidate.trust_context.friend_name
            or "A friend"
        )
        signal_text = candidate.trust_context.signal_text or sig.content or "Checked in nearby"
        vibe_label = _vibe_label_from_strength(sig.effective_strength)
        trust_attributions.append(
            TrustAttribution(
                user_name=name,
                signal_summary=(
                    candidate.trust_context.relationship_label
                    or _relationship_label(candidate.trust_context.is_friend_checkin)
                ),
                vibe_label=vibe_label,
            )
        )
        primary_signal = PrimarySignal(
            user_name=name,
            timestamp=sig.emitted_at,
            vibe_label=vibe_label,
            comment=signal_text,
        )

    return OpportunityOut(
        id=uuid.uuid4(),
        venue_name=candidate.venue_name,
        category=candidate.category,
        distance_meters=candidate.distance_meters,
        eta_minutes=candidate.eta_minutes,
        rationale=rationale,
        trust_attributions=trust_attributions,
        geo=candidate.geo,
        is_primary=is_primary,
        event=None,  # Phase 2: populate for event-backed opportunities
        primary_signal=primary_signal,
    )


async def make_decision(
    candidate_set: CandidateSet,
    context_state_id: uuid.UUID,
    time_of_day: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> DecideResponse | None:
    """Convert ranked candidates into a single confident recommendation.

    Returns None if no candidate meets the confidence threshold —
    "Nothing great right now" is a valid answer.
    """
    _ = user_id
    _ = db
    candidates = candidate_set.candidates
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

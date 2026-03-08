"""Layer 3: Trust Layer — re-weights signals and emits venue-level trust context."""

from dataclasses import dataclass, field
from collections.abc import Mapping, Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import SocialEdge, User
from app.schemas.candidate import CandidateSignal, SignalBundle, TrustContext
from app.services.signal_aggregator import AggregatedSignal

# Trust multipliers
FRIEND_TRUST_MULTIPLIER = 10.0   # 1st-degree friend
ANONYMOUS_TRUST_MULTIPLIER = 1.0  # Unknown user
DIRECT_FRIEND_WINDOW_HOURS = 6.0


@dataclass(frozen=True)
class TrustResult:
    """Trust computation result with weights and resolved friend names."""

    weights: dict[UUID, float] = field(default_factory=dict)
    friend_names: dict[UUID, str] = field(default_factory=dict)
    user_names: dict[UUID, str] = field(default_factory=dict)


def _first_name(value: str | None) -> str:
    if not value:
        return "Someone"
    parts = value.strip().split()
    if not parts:
        return "Someone"
    return parts[0]


def _has_raw_text(signal: CandidateSignal) -> bool:
    return bool((signal.content or "").strip())


def _is_direct_friend_signal(
    signal: CandidateSignal,
    trust_weights: Mapping[UUID, float],
) -> bool:
    return (
        trust_weights.get(signal.signal_id, ANONYMOUS_TRUST_MULTIPLIER) > ANONYMOUS_TRUST_MULTIPLIER
        and signal.age_hours < DIRECT_FRIEND_WINDOW_HOURS
    )


def _preferred_signal(signals: Sequence[CandidateSignal]) -> CandidateSignal:
    """Prefer raw text over silent check-ins, then strongest and freshest."""
    return max(
        signals,
        key=lambda sig: (
            1 if _has_raw_text(sig) else 0,
            sig.effective_strength,
            -sig.age_hours,
        ),
    )


def _select_mayor_signal(signals: Sequence[CandidateSignal]) -> CandidateSignal | None:
    """Choose neighborhood mayor by local credibility from venue-bound signals."""
    scored_by_user: dict[UUID, float] = {}
    user_signals: dict[UUID, list[CandidateSignal]] = {}

    for signal in signals:
        source_user_id = signal.source_user_id
        if source_user_id is None:
            continue
        credibility = signal.effective_strength
        if _has_raw_text(signal):
            credibility += 0.35
        scored_by_user[source_user_id] = scored_by_user.get(source_user_id, 0.0) + credibility
        user_signals.setdefault(source_user_id, []).append(signal)

    if not scored_by_user:
        return None

    mayor_user_id = max(scored_by_user.items(), key=lambda item: item[1])[0]
    return _preferred_signal(user_signals[mayor_user_id])


def _bundle_for_signal(
    signal: CandidateSignal,
    user_names: Mapping[UUID, str],
) -> SignalBundle:
    first_name = None
    if signal.source_user_id is not None:
        first_name = _first_name(user_names.get(signal.signal_id))

    minutes_ago = max(0, int(round(signal.age_hours * 60)))
    return SignalBundle(
        user_first_name=first_name,
        signal_type=signal.signal_type,
        minutes_ago=minutes_ago,
    )


def _operator_name_for_signal(
    signal: CandidateSignal,
    friend_names: Mapping[UUID, str],
    user_names: Mapping[UUID, str],
) -> str | None:
    return friend_names.get(signal.signal_id) or user_names.get(signal.signal_id)


async def compute_trust_weights(
    signals: list[AggregatedSignal],
    user_id: UUID,
    db: AsyncSession,
) -> TrustResult:
    """Compute trust multiplier per signal based on social graph proximity.

    MVP: 1st-degree friends get 10x multiplier, everyone else gets 1x.
    Also resolves friend names for signals emitted by friends.

    Returns:
        TrustResult with weights (signal.id → multiplier),
        friend_names (signal.id → direct friend first name), and
        user_names (signal.id → resolved user first name).
    """
    if not signals:
        return TrustResult()

    # Load 1st-degree friend IDs from social graph
    result = await db.execute(
        select(SocialEdge).where(
            or_(
                SocialEdge.user_a == user_id,
                SocialEdge.user_b == user_id,
            )
        )
    )
    edges = result.scalars().all()

    # Build set of friend user IDs
    friend_ids: set[UUID] = set()
    for edge in edges:
        if edge.user_a == user_id:
            friend_ids.add(edge.user_b)
        else:
            friend_ids.add(edge.user_a)

    # Assign trust multiplier per signal and collect source user IDs.
    trust_weights: dict[UUID, float] = {}
    friend_source_ids: set[UUID] = set()
    source_user_ids: set[UUID] = set()
    for sig in signals:
        source_user_id = sig.signal.source_user_id
        signal_id = sig.signal.id
        if source_user_id:
            source_user_ids.add(source_user_id)
        if source_user_id and source_user_id in friend_ids:
            trust_weights[signal_id] = FRIEND_TRUST_MULTIPLIER
            friend_source_ids.add(source_user_id)
        else:
            trust_weights[signal_id] = ANONYMOUS_TRUST_MULTIPLIER

    # Batch-load names only for users that appear in current signals.
    friend_names: dict[UUID, str] = {}
    user_names: dict[UUID, str] = {}
    if source_user_ids:
        name_result = await db.execute(
            select(User.id, User.name, User.username).where(
                User.id.in_(source_user_ids)
            )
        )
        user_name_map: dict[UUID, str] = {}
        for row in name_result.all():
            user_name_map[row.id] = _first_name(row.name or row.username or "Someone")

        for sig in signals:
            source_user_id = sig.signal.source_user_id
            if source_user_id and source_user_id in user_name_map:
                resolved_name = user_name_map[source_user_id]
                user_names[sig.signal.id] = resolved_name
                if source_user_id in friend_source_ids:
                    friend_names[sig.signal.id] = resolved_name

    return TrustResult(weights=trust_weights, friend_names=friend_names, user_names=user_names)


def build_venue_trust_contexts(
    venue_signals: Mapping[str, Sequence[CandidateSignal]],
    trust_weights: Mapping[UUID, float],
    friend_names: Mapping[UUID, str],
    user_names: Mapping[UUID, str],
) -> dict[str, TrustContext]:
    """Build TrustContext per venue key for LLM prompt-grounding."""
    contexts: dict[str, TrustContext] = {}

    for venue_key, signals in venue_signals.items():
        if not signals:
            contexts[venue_key] = TrustContext()
            continue

        # 1) Direct Friend within 6h
        direct_friend_signals = [
            signal
            for signal in signals
            if _is_direct_friend_signal(signal, trust_weights)
        ]
        if direct_friend_signals:
            selected = _preferred_signal(direct_friend_signals)
            operator_name = _operator_name_for_signal(selected, friend_names, user_names) or "A friend"
            contexts[venue_key] = TrustContext(
                is_friend_checkin=True,
                operator_name=operator_name,
                interaction_type="DIRECT_FRIEND",
                environmental_context=None,
                friend_name=operator_name,
                signal_text=(selected.content or "").strip() or None,
                signal_bundle=_bundle_for_signal(selected, user_names),
            )
            continue

        # 2) Local Mayor (highest local credibility)
        mayor_signal = _select_mayor_signal(signals)
        if mayor_signal is not None:
            operator_name = _operator_name_for_signal(mayor_signal, friend_names, user_names)
            contexts[venue_key] = TrustContext(
                is_friend_checkin=False,
                operator_name=operator_name,
                interaction_type="LOCAL_MAYOR",
                environmental_context=None,
                friend_name=operator_name,
                signal_text=(mayor_signal.content or "").strip() or None,
                signal_bundle=_bundle_for_signal(mayor_signal, user_names),
            )
            continue

        # 3) Fallback to strongest available signal
        strongest_signal = _preferred_signal(signals)
        contexts[venue_key] = TrustContext(
            is_friend_checkin=False,
            operator_name=_operator_name_for_signal(strongest_signal, friend_names, user_names),
            interaction_type="PUBLIC_SIGNAL",
            environmental_context=None,
            friend_name=None,
            signal_text=(strongest_signal.content or "").strip() or None,
            signal_bundle=_bundle_for_signal(strongest_signal, user_names),
        )

    return contexts

"""Layer 3: Trust Layer — re-weights signals and emits venue-level trust context."""

from dataclasses import dataclass, field
from collections.abc import Mapping, Sequence
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Friendship, User
from app.schemas.candidate import CandidateSignal, SignalBundle, TrustContext
from app.services.signal_aggregator import AggregatedSignal

# Trust multipliers
MUTUAL_TRUST_MULTIPLIER = 10.0    # Reciprocal accepted friendship
FOLLOWER_TRUST_MULTIPLIER = 5.0   # One-way friendship
STRANGER_TRUST_MULTIPLIER = 1.0   # No friendship
DIRECT_FRIEND_WINDOW_HOURS = 6.0


@dataclass(frozen=True)
class TrustResult:
    """Trust computation result with weights and resolved friend names."""

    weights: dict[UUID, float] = field(default_factory=dict)
    relationship_labels: dict[UUID, str] = field(default_factory=dict)
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
        trust_weights.get(signal.signal_id, STRANGER_TRUST_MULTIPLIER) >= MUTUAL_TRUST_MULTIPLIER
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

    Friendship rules:
    - Mutual accepted rows (reciprocal) → 10x
    - Outgoing-only row → 5x
    - No rows → 1x
    Also resolves friend names for signals emitted by mutual friends.

    Returns:
        TrustResult with weights (signal.id → multiplier),
        relationship_labels (signal.id → label),
        friend_names (signal.id → direct friend first name), and
        user_names (signal.id → resolved user first name).
    """
    if not signals:
        return TrustResult()

    # Collect source user IDs from signals
    source_user_ids: set[UUID] = {
        sig.signal.source_user_id
        for sig in signals
        if sig.signal.source_user_id is not None
    }

    # Preload friendship rows between current user and signal owners.
    outgoing_statuses: dict[UUID, str | None] = {}
    incoming_statuses: dict[UUID, str | None] = {}
    if source_user_ids:
        result = await db.execute(
            select(Friendship.user_id, Friendship.friend_id, Friendship.status).where(
                or_(
                    and_(
                        Friendship.user_id == user_id,
                        Friendship.friend_id.in_(source_user_ids),
                    ),
                    and_(
                        Friendship.user_id.in_(source_user_ids),
                        Friendship.friend_id == user_id,
                    ),
                )
            )
        )
        for row in result.all():
            if row.user_id == user_id:
                outgoing_statuses[row.friend_id] = row.status
            else:
                incoming_statuses[row.user_id] = row.status

    # Assign trust multiplier per signal and collect source user IDs.
    trust_weights: dict[UUID, float] = {}
    relationship_labels: dict[UUID, str] = {}
    status_debug: dict[UUID, tuple[str | None, str | None]] = {}
    mutual_source_ids: set[UUID] = set()
    for sig in signals:
        source_user_id = sig.signal.source_user_id
        signal_id = sig.signal.id
        if source_user_id is None:
            trust_weights[signal_id] = STRANGER_TRUST_MULTIPLIER
            relationship_labels[signal_id] = "Local Explorer"
            continue

        outgoing = outgoing_statuses.get(source_user_id)
        incoming = incoming_statuses.get(source_user_id)
        status_debug[source_user_id] = (outgoing, incoming)
        print(
            f"DEBUG: Checking trust between Current User {user_id} and Signal Owner {source_user_id}"
        )
        outgoing_accepted = outgoing == "accepted"
        incoming_accepted = incoming == "accepted"
        if outgoing_accepted and incoming_accepted:
            multiplier = MUTUAL_TRUST_MULTIPLIER
            mutual_source_ids.add(source_user_id)
            label = "Mutual Friend"
        elif outgoing_accepted:
            multiplier = FOLLOWER_TRUST_MULTIPLIER
            label = "Follower"
        else:
            multiplier = STRANGER_TRUST_MULTIPLIER
            label = "Local Explorer"
        trust_weights[signal_id] = multiplier
        relationship_labels[signal_id] = label

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
            user_name_map[row.id] = (row.name or row.username or "Someone").strip()

        for sig in signals:
            source_user_id = sig.signal.source_user_id
            if source_user_id and source_user_id in user_name_map:
                resolved_name = user_name_map[source_user_id]
                user_names[sig.signal.id] = resolved_name
                if source_user_id in mutual_source_ids:
                    friend_names[sig.signal.id] = resolved_name
                if resolved_name == "Jordan Kim":
                    outgoing, incoming = status_debug.get(source_user_id, (None, None))
                    if trust_weights.get(sig.signal.id, STRANGER_TRUST_MULTIPLIER) < FOLLOWER_TRUST_MULTIPLIER:
                        reasons: list[str] = []
                        if outgoing is None:
                            reasons.append("No row found in public.friendships (outgoing)")
                        elif outgoing != "accepted":
                            reasons.append(f"Outgoing status={outgoing}")
                        if incoming is None:
                            reasons.append("No row found in public.friendships (incoming)")
                        elif incoming != "accepted":
                            reasons.append(f"Incoming status={incoming}")
                        print(
                            f"DEBUG: Jordan Kim trust check failed: {', '.join(reasons) or 'Unknown'}"
                        )

    return TrustResult(
        weights=trust_weights,
        relationship_labels=relationship_labels,
        friend_names=friend_names,
        user_names=user_names,
    )


def build_venue_trust_contexts(
    venue_signals: Mapping[str, Sequence[CandidateSignal]],
    trust_weights: Mapping[UUID, float],
    relationship_labels: Mapping[UUID, str],
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
                relationship_label=relationship_labels.get(selected.signal_id, "Local Explorer"),
                trust_multiplier=trust_weights.get(selected.signal_id, STRANGER_TRUST_MULTIPLIER),
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
                relationship_label=relationship_labels.get(mayor_signal.signal_id, "Local Explorer"),
                trust_multiplier=trust_weights.get(mayor_signal.signal_id, STRANGER_TRUST_MULTIPLIER),
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
            relationship_label=relationship_labels.get(strongest_signal.signal_id, "Local Explorer"),
            trust_multiplier=trust_weights.get(strongest_signal.signal_id, STRANGER_TRUST_MULTIPLIER),
            friend_name=None,
            signal_text=(strongest_signal.content or "").strip() or None,
            signal_bundle=_bundle_for_signal(strongest_signal, user_names),
        )

    return contexts

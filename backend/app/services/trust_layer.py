"""Layer 3: Trust Layer — re-weights signals by social proximity.

MVP: loads 1st-degree social edges and returns a trust multiplier per signal.
Friend signals get 10x weight, anonymous signals get 1x.
2nd-degree and event-specific trust weighting deferred to Phase 2.

For EVENT signals (Phase 2), trust weighting will consider:
- Host trust: Is the event host in the user's trust network?
  - 1st-degree friend hosting: 10x weight
  - 2nd-degree connection hosting: 3x weight
  - Unknown host (user event): 0.5x weight
  - Verified business: 1.0x (neutral)
- Friend interest: Each friend who said "I'm in" adds 1.5x (capped at 3 friends).
"""

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.signal import Signal
from app.models.user import SocialEdge

# Trust multipliers
FRIEND_TRUST_MULTIPLIER = 10.0   # 1st-degree friend
ANONYMOUS_TRUST_MULTIPLIER = 1.0  # Unknown user

# Phase 2 constants (preserved for later)
EVENT_TRUST_MULTIPLIERS = {
    1: 10.0,    # 1st-degree friend hosting
    2: 3.0,     # 2nd-degree connection hosting
}
EVENT_UNKNOWN_HOST_MULTIPLIER = 0.5
EVENT_BUSINESS_MULTIPLIER = 1.0
EVENT_FRIEND_INTEREST_MULTIPLIER = 1.5
EVENT_MAX_INTEREST_FRIENDS = 3


async def compute_trust_weights(
    signals: list[Signal],
    user_id: UUID,
    db: AsyncSession,
) -> dict[UUID, float]:
    """Compute trust multiplier per signal based on social graph proximity.

    MVP: 1st-degree friends get 10x multiplier, everyone else gets 1x.

    Returns:
        dict mapping signal.id → trust multiplier float.
    """
    if not signals:
        return {}

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

    # Assign trust multiplier per signal
    trust_weights: dict[UUID, float] = {}
    for sig in signals:
        if sig.source_user_id and sig.source_user_id in friend_ids:
            trust_weights[sig.id] = FRIEND_TRUST_MULTIPLIER
        else:
            trust_weights[sig.id] = ANONYMOUS_TRUST_MULTIPLIER

    return trust_weights

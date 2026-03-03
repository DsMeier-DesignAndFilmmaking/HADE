"""Layer 3: Trust Layer — re-weights signals by social proximity."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.signal import Signal
from app.models.trust_score import TrustScore


async def compute_trust_weights(
    signals: list[Signal],
    user_id: UUID,
    db: AsyncSession,
) -> dict[UUID, TrustScore]:
    """Re-weight signals based on social graph proximity to requesting user.

    Second-degree network visits carry 10x the weight of anonymous signals.
    """
    # TODO: Load user's social graph (1st and 2nd degree)
    # TODO: For each signal, determine network depth
    # TODO: Compute TrustScore per venue
    raise NotImplementedError

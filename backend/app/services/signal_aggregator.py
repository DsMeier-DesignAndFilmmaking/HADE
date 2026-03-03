"""Layer 2: Signal Aggregator — ingests and normalizes signals with decay rates."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.context_state import ContextState
from app.models.signal import Signal


async def aggregate_signals(
    context: ContextState,
    user_id: UUID,
    db: AsyncSession,
) -> list[Signal]:
    """Fetch and normalize signals within context radius, applying decay weights."""
    # TODO: Spatial query for signals near context.geo
    # TODO: Filter by expires_at > now
    # TODO: Apply decay function based on signal type
    # TODO: Normalize strength values
    raise NotImplementedError

"""Layer 1: Context Engine — builds ContextState from geo, time, weather, energy, group size."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.context_state import ContextState
from app.schemas.decide import DecideRequest


async def build_context_state(
    request: DecideRequest,
    user_id: UUID,
    db: AsyncSession,
) -> ContextState:
    """Aggregate device signals and declared intent into a ContextState snapshot."""
    # TODO: Resolve time_of_day, day_type from timestamp
    # TODO: Fetch weather from OpenWeatherMap
    # TODO: Infer energy level from behavioral history
    # TODO: Persist and return ContextState
    raise NotImplementedError

"""Layer 5: Decision Layer — one primary recommendation + rationale + fallbacks."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.opportunity import Opportunity
from app.schemas.decide import DecideResponse


async def make_decision(
    opportunities: list[Opportunity],
    user_id: UUID,
    db: AsyncSession,
) -> DecideResponse | None:
    """Convert ranked opportunities into a single confident recommendation.

    Returns None if no opportunity meets the confidence threshold.
    """
    # TODO: Select primary (highest score)
    # TODO: Generate human-readable rationale with trust attribution
    # TODO: Select 2-3 fallbacks
    # TODO: Persist as Moments for logging
    raise NotImplementedError

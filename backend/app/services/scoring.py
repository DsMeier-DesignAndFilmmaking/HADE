"""Layer 4: Scoring System — produces OpportunityScore per candidate venue."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.context_state import ContextState
from app.models.opportunity import Opportunity
from app.models.signal import Signal
from app.models.trust_score import TrustScore


async def score_opportunities(
    context: ContextState,
    signals: list[Signal],
    trust_scores: dict[UUID, TrustScore],
    user_id: UUID,
    db: AsyncSession,
) -> list[Opportunity]:
    """Score candidate venues. Trust signals multiply, not add.

    Enforces confidence floor — returns empty list if no signal is strong enough.
    """
    # TODO: Group signals by venue
    # TODO: Compute composite score (trust * recency * novelty)
    # TODO: Apply confidence floor
    # TODO: Rank and return top opportunities
    raise NotImplementedError

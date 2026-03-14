"""DDR (Decision-to-Departure Rate) metrics service.

Provides the core query for HADE's north star metric:
  DDR = accepted_moments / total_moments × 100
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.moment import Moment, MomentAction


@dataclass(frozen=True)
class DDRResult:
    accepted: int
    dismissed: int
    ignored: int
    total: int
    ddr_pct: float
    period_hours: int


async def compute_ddr(
    db: AsyncSession,
    period_hours: int = 24,
    user_id: UUID | None = None,
) -> DDRResult:
    """Calculate DDR over a rolling window.

    Args:
        db: Async database session.
        period_hours: Lookback window in hours (default 24).
        user_id: Optional filter to compute per-user DDR.

    Returns:
        DDRResult with counts and percentage.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=period_hours)

    filters = [Moment.surfaced_at >= cutoff]
    if user_id is not None:
        filters.append(Moment.user_id == user_id)

    stmt = select(
        func.count().filter(Moment.action == MomentAction.ACCEPTED).label("accepted"),
        func.count().filter(Moment.action == MomentAction.DISMISSED).label("dismissed"),
        func.count().label("total"),
    ).where(*filters)

    row = (await db.execute(stmt)).one()
    accepted: int = row.accepted or 0
    dismissed: int = row.dismissed or 0
    total: int = row.total or 0
    ignored = total - accepted - dismissed
    ddr_pct = round(accepted / total * 100, 2) if total > 0 else 0.0

    return DDRResult(
        accepted=accepted,
        dismissed=dismissed,
        ignored=ignored,
        total=total,
        ddr_pct=ddr_pct,
        period_hours=period_hours,
    )

"""Analytics endpoints — DDR and operational metrics."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.schemas.analytics import DDRResponse
from app.schemas.common import ApiResponse, ResponseMeta
from app.services.metrics import compute_ddr

router = APIRouter(tags=["analytics"])


@router.get("/analytics/ddr", response_model=ApiResponse[DDRResponse])
async def get_ddr(
    period_hours: int = Query(default=24, ge=1, le=720),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[DDRResponse]:
    """Return the Decision-to-Departure Rate for the given lookback window."""
    result = await compute_ddr(db, period_hours=period_hours)

    return ApiResponse(
        status="ok",
        data=DDRResponse(
            accepted=result.accepted,
            dismissed=result.dismissed,
            ignored=result.ignored,
            total=result.total,
            ddr_pct=result.ddr_pct,
            period_hours=result.period_hours,
        ),
        meta=ResponseMeta(request_id=uuid.uuid4()),
    )

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.schemas.common import ApiResponse
from app.schemas.decide import DecideRequest, DecideResponse

router = APIRouter(tags=["decide"])


@router.post("/decide", response_model=ApiResponse[DecideResponse])
async def decide(
    request: DecideRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[DecideResponse]:
    """Core endpoint — returns one recommendation."""
    # TODO: Context Engine → Signal Aggregator → Trust Layer → Scoring → Decision
    raise NotImplementedError

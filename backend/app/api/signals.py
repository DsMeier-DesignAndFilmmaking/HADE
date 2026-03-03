from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.schemas.common import ApiResponse
from app.schemas.signal import SignalCreate, SignalNearbyResponse, SignalResponse

router = APIRouter(tags=["signals"])


@router.post("/signals", response_model=ApiResponse[SignalResponse])
async def emit_signal(
    payload: SignalCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SignalResponse]:
    """Emit a signal (check-in, note, presence)."""
    # TODO: Validate, persist, and propagate signal
    raise NotImplementedError


@router.get("/signals/nearby", response_model=ApiResponse[SignalNearbyResponse])
async def signals_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: int = Query(default=500),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SignalNearbyResponse]:
    """Live signals within radius."""
    # TODO: Spatial query for nearby signals
    raise NotImplementedError

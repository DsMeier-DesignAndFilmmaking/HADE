from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.schemas.common import ApiResponse
from app.schemas.venue import VenueResponse

router = APIRouter(tags=["venues"])


@router.get("/venues/{venue_id}", response_model=ApiResponse[VenueResponse])
async def get_venue(
    venue_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[VenueResponse]:
    """Venue detail with live signal overlay."""
    # TODO: Fetch venue with current signals
    raise NotImplementedError


@router.get("/venues/nearby", response_model=ApiResponse[list[VenueResponse]])
async def venues_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: int = Query(default=500),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[VenueResponse]]:
    """Venues within radius (raw, pre-scoring)."""
    # TODO: Spatial query for nearby venues
    raise NotImplementedError

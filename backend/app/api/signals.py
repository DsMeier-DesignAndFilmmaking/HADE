import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.models.signal import Signal, SignalType
from app.models.venue import Venue
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.signal import SignalCreate, SignalNearbyResponse, SignalResponse

router = APIRouter(tags=["signals"])

SIGNAL_TTL_BY_TYPE: dict[SignalType, timedelta] = {
    SignalType.PRESENCE: timedelta(minutes=45),
    SignalType.SOCIAL_RELAY: timedelta(hours=6),
    SignalType.ENVIRONMENTAL: timedelta(hours=8),
    SignalType.BEHAVIORAL: timedelta(days=7),
    SignalType.AMBIENT: timedelta(days=30),
    SignalType.EVENT: timedelta(hours=2),
}

VIBE_STRENGTH: dict[str, float] = {
    "fire": 1.0,
    "chill": 0.7,
    "avoid": 0.4,
}


def _wkt_point(lat: float, lng: float) -> str:
    return f"SRID=4326;POINT({lng} {lat})"


@router.post(
    "/signals",
    response_model=ApiResponse[SignalResponse],
    status_code=status.HTTP_201_CREATED,
)
async def emit_signal(
    payload: SignalCreate,
    # Returns the HADE users.id UUID (not Supabase auth.users.sub).
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SignalResponse]:
    """Emit a signal (check-in, note, presence)."""
    signal_type = SignalType.PRESENCE
    emitted_at = datetime.now(timezone.utc)
    expires_at = emitted_at + SIGNAL_TTL_BY_TYPE[signal_type]

    # Decision opportunities are not always persisted venues yet.
    # If venue_id is unknown, keep the signal geo-only for now.
    venue_id: UUID | None = payload.venue_id
    if venue_id is not None:
        venue = await db.get(Venue, venue_id)
        if venue is None:
            venue_id = None

    vibe = (payload.vibe or "").lower().strip() # Normalize input
    strength = float(VIBE_STRENGTH.get(vibe, 0.8)) # Ensure it's a float
    normalized_content = (payload.content or "").strip() or None

    signal = Signal(
        id=uuid.uuid4(),
        type=signal_type,
        source_user_id=user_id,
        venue_id=venue_id,
        content=normalized_content,
        strength=strength,
        # emitted_at is the "created-at" reference timestamp used by decay logic.
        emitted_at=emitted_at,
        expires_at=expires_at,
        geo=_wkt_point(payload.geo.lat, payload.geo.lng),
    )
    db.add(signal)
    await db.commit()
    await db.refresh(signal)

    return ApiResponse(
        status="ok",
        data=SignalResponse(
            id=signal.id,
            type=signal.type.value,
            venue_id=signal.venue_id,
            content=signal.content,
            strength=signal.strength,
            emitted_at=signal.emitted_at,
            expires_at=signal.expires_at,
            geo=payload.geo,
        ),
        meta=ResponseMeta(request_id=uuid.uuid4()),
    )


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

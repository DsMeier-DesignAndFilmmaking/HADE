"""Micro Events API — create, manage, and express interest in spontaneous events."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.models.micro_event import EventInterest, EventStatus, EventVisibility, MicroEvent
from app.models.signal import Signal, SignalType
from app.models.user import User
from app.models.venue import Venue
from app.schemas.common import ApiResponse, GeoLocation
from app.schemas.event import EventCreate, EventResponse

router = APIRouter(tags=["events"])

MAX_FUTURE_HOURS = 6
MAX_DURATION_MINUTES = 240


def _wkt_point(geo: GeoLocation) -> str:
    """Build a WKT POINT string for PostGIS."""
    return f"SRID=4326;POINT({geo.lng} {geo.lat})"


async def _build_event_response(
    event: MicroEvent,
    requesting_user_id: UUID,
    db: AsyncSession,
) -> EventResponse:
    """Build EventResponse with host info, venue name, and interest status."""
    # Host info
    host = await db.get(User, event.host_user_id)
    host_name = host.name if host else "Unknown"
    host_username = host.username if host else None

    # Venue name
    venue_name: str | None = None
    if event.venue_id:
        venue = await db.get(Venue, event.venue_id)
        venue_name = venue.name if venue else None

    # Is the requesting user interested?
    result = await db.execute(
        select(EventInterest).where(
            EventInterest.event_id == event.id,
            EventInterest.user_id == requesting_user_id,
        )
    )
    is_interested = result.scalar_one_or_none() is not None

    return EventResponse(
        id=event.id,
        host_name=host_name,
        host_username=host_username,
        title=event.title,
        note=event.note,
        category=event.category,
        venue_name=venue_name,
        geo=GeoLocation(lat=0.0, lng=0.0),  # TODO: extract from PostGIS point
        address=event.address,
        starts_at=event.starts_at,
        expires_at=event.expires_at,
        status=event.status.value,
        visibility=event.visibility.value,
        is_interested=is_interested,
        friend_interest_hint=None,  # Phase 2
    )


@router.post("/events", response_model=ApiResponse[EventResponse])
async def create_event(
    payload: EventCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[EventResponse]:
    """Create a micro event. Auto-emits an EVENT signal."""
    now = datetime.now(timezone.utc)

    # Default starts_at to now
    starts_at = payload.starts_at or now
    if starts_at < now - timedelta(minutes=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="starts_at cannot be in the past",
        )
    if starts_at > now + timedelta(hours=MAX_FUTURE_HOURS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Events cannot start more than {MAX_FUTURE_HOURS} hours from now",
        )

    expires_at = starts_at + timedelta(minutes=payload.duration_minutes)

    # Auto-fill address from venue if provided
    address = payload.address
    geo = payload.geo
    if payload.venue_id:
        venue = await db.get(Venue, payload.venue_id)
        if venue is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venue not found",
            )
        if not address:
            address = venue.address

    # Determine initial status
    initial_status = EventStatus.LIVE if starts_at <= now else EventStatus.UPCOMING

    # Determine visibility
    visibility = EventVisibility(payload.visibility)

    event = MicroEvent(
        host_user_id=user_id,
        venue_id=payload.venue_id,
        title=payload.title.strip(),
        note=payload.note.strip() if payload.note else None,
        category=payload.category,
        geo=_wkt_point(geo),
        address=address,
        starts_at=starts_at,
        expires_at=expires_at,
        visibility=visibility,
        status=initial_status,
    )
    db.add(event)

    # Auto-emit EVENT signal
    signal = Signal(
        type=SignalType.EVENT,
        source_user_id=user_id,
        venue_id=payload.venue_id,
        event_id=event.id,
        content=payload.title.strip(),
        strength=1.0,
        emitted_at=now,
        expires_at=expires_at,
        geo=_wkt_point(geo),
    )
    db.add(signal)

    await db.commit()
    await db.refresh(event)

    response = await _build_event_response(event, user_id, db)
    return ApiResponse(data=response)


@router.get("/events/{event_id}", response_model=ApiResponse[EventResponse])
async def get_event(
    event_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[EventResponse]:
    """Get event detail."""
    event = await db.get(MicroEvent, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    response = await _build_event_response(event, user_id, db)
    return ApiResponse(data=response)


@router.post("/events/{event_id}/cancel", response_model=ApiResponse[EventResponse])
async def cancel_event(
    event_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[EventResponse]:
    """Host cancels an event. Expires associated signals."""
    event = await db.get(MicroEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can cancel")
    if event.status in (EventStatus.ENDED, EventStatus.CANCELLED):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event already ended or cancelled")

    now = datetime.now(timezone.utc)
    event.status = EventStatus.CANCELLED

    # Expire all associated signals immediately
    result = await db.execute(select(Signal).where(Signal.event_id == event_id))
    for signal in result.scalars():
        signal.expires_at = now

    await db.commit()
    await db.refresh(event)

    response = await _build_event_response(event, user_id, db)
    return ApiResponse(data=response)


@router.post("/events/{event_id}/end", response_model=ApiResponse[EventResponse])
async def end_event(
    event_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[EventResponse]:
    """Host ends an event early."""
    event = await db.get(MicroEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can end")
    if event.status in (EventStatus.ENDED, EventStatus.CANCELLED):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event already ended or cancelled")

    now = datetime.now(timezone.utc)
    event.status = EventStatus.ENDED
    event.expires_at = now

    # Expire associated signals
    result = await db.execute(select(Signal).where(Signal.event_id == event_id))
    for signal in result.scalars():
        signal.expires_at = now

    await db.commit()
    await db.refresh(event)

    response = await _build_event_response(event, user_id, db)
    return ApiResponse(data=response)


@router.post("/events/{event_id}/in", response_model=ApiResponse[EventResponse])
async def express_interest(
    event_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[EventResponse]:
    """Express interest in an event ('I'm in'). Emits a SOCIAL_RELAY signal."""
    event = await db.get(MicroEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.status in (EventStatus.ENDED, EventStatus.CANCELLED):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event is no longer active")

    # Check if already interested
    result = await db.execute(
        select(EventInterest).where(
            EventInterest.event_id == event_id,
            EventInterest.user_id == user_id,
        )
    )
    if result.scalar_one_or_none() is not None:
        # Already interested, just return current state
        response = await _build_event_response(event, user_id, db)
        return ApiResponse(data=response)

    # Record interest
    interest = EventInterest(event_id=event_id, user_id=user_id)
    db.add(interest)

    # Emit SOCIAL_RELAY signal for the interested user's trust network
    user = await db.get(User, user_id)
    user_name = user.name if user else "Someone"
    now = datetime.now(timezone.utc)

    relay_signal = Signal(
        type=SignalType.SOCIAL_RELAY,
        source_user_id=user_id,
        venue_id=event.venue_id,
        event_id=event_id,
        content=f"{user_name} is heading to: {event.title}",
        strength=0.8,
        emitted_at=now,
        expires_at=event.expires_at,
        geo=event.geo,
    )
    db.add(relay_signal)

    await db.commit()
    await db.refresh(event)

    response = await _build_event_response(event, user_id, db)
    return ApiResponse(data=response)


@router.delete("/events/{event_id}/in", response_model=ApiResponse[EventResponse])
async def withdraw_interest(
    event_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[EventResponse]:
    """Withdraw interest from an event."""
    event = await db.get(MicroEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    result = await db.execute(
        select(EventInterest).where(
            EventInterest.event_id == event_id,
            EventInterest.user_id == user_id,
        )
    )
    interest = result.scalar_one_or_none()
    if interest:
        await db.delete(interest)
        await db.commit()

    response = await _build_event_response(event, user_id, db)
    return ApiResponse(data=response)

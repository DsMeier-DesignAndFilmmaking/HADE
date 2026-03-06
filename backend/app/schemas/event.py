from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import GeoLocation


class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=80)
    note: str | None = Field(default=None, max_length=200)
    category: str = Field(..., pattern=r"^(eat|drink|chill|scene|anything)$")
    venue_id: UUID | None = None
    geo: GeoLocation
    address: str | None = Field(default=None, max_length=500)
    starts_at: datetime | None = None
    duration_minutes: int = Field(default=120, ge=15, le=240)
    visibility: str = Field(default="TRUST_NETWORK", pattern=r"^(TRUST_NETWORK|EXTENDED|OPEN)$")


class EventInfo(BaseModel):
    """Included in OpportunityOut when the recommendation is event-backed."""
    event_id: UUID
    title: str
    host_name: str
    starts_at: datetime
    expires_at: datetime
    interest_count_hint: str | None = None


class EventResponse(BaseModel):
    id: UUID
    host_name: str
    host_username: str | None
    title: str
    note: str | None
    category: str
    venue_name: str | None
    geo: GeoLocation
    address: str | None
    starts_at: datetime
    expires_at: datetime
    status: str
    visibility: str
    is_interested: bool
    friend_interest_hint: str | None = None

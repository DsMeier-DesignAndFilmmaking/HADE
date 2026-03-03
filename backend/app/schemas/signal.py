from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import GeoLocation


class SignalCreate(BaseModel):
    venue_id: UUID | None = None
    content: str | None = None
    geo: GeoLocation


class SignalResponse(BaseModel):
    id: UUID
    type: str
    venue_id: UUID | None
    content: str | None
    strength: float
    emitted_at: datetime
    expires_at: datetime
    geo: GeoLocation


class SignalNearbyResponse(BaseModel):
    signals: list[SignalResponse]

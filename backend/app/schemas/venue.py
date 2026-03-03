from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import GeoLocation


class VenueResponse(BaseModel):
    id: UUID
    name: str
    category: str
    geo: GeoLocation
    address: str
    price_tier: int
    is_open_now: bool
    live_busyness: float | None
    last_signal_at: datetime | None

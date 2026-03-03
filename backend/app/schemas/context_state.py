from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import GeoLocation


class WeatherState(BaseModel):
    condition: str
    temp: float
    precip_probability: float


class ContextStateResponse(BaseModel):
    id: UUID
    user_id: UUID
    timestamp: datetime
    geo: GeoLocation
    time_of_day: str
    day_type: str
    weather: WeatherState | None
    group_size: int
    intent_declared: str | None
    energy_inferred: str
    session_id: UUID

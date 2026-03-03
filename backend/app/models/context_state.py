import enum
import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, Enum, Float, Integer, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class DayType(str, enum.Enum):
    WEEKDAY = "WEEKDAY"
    WEEKEND = "WEEKEND"
    HOLIDAY = "HOLIDAY"


class EnergyLevel(str, enum.Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


class ContextState(Base):
    __tablename__ = "context_states"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    geo: Mapped[str] = mapped_column(Geography(geometry_type="POINT", srid=4326))
    geo_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    time_of_day: Mapped[str] = mapped_column(String(50))
    day_type: Mapped[DayType] = mapped_column(Enum(DayType))
    weather_condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    weather_temp: Mapped[float | None] = mapped_column(Float, nullable=True)
    weather_precip_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    group_size: Mapped[int] = mapped_column(Integer, default=1)
    intent_declared: Mapped[str | None] = mapped_column(String(100), nullable=True)
    energy_inferred: Mapped[EnergyLevel] = mapped_column(Enum(EnergyLevel), default=EnergyLevel.MODERATE)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))

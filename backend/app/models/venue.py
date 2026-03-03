import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class Venue(Base):
    __tablename__ = "venues"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(255))
    geo: Mapped[str] = mapped_column(Geography(geometry_type="POINT", srid=4326))
    address: Mapped[str] = mapped_column(String(500))
    price_tier: Mapped[int] = mapped_column(Integer)
    is_open_now: Mapped[bool] = mapped_column(Boolean, default=False)
    live_busyness: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_signal_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

import enum
import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, Enum, Float, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class SignalType(str, enum.Enum):
    PRESENCE = "PRESENCE"
    SOCIAL_RELAY = "SOCIAL_RELAY"
    ENVIRONMENTAL = "ENVIRONMENTAL"
    BEHAVIORAL = "BEHAVIORAL"
    AMBIENT = "AMBIENT"


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[SignalType] = mapped_column(Enum(SignalType))
    source_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    venue_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("venues.id"), nullable=True)
    content: Mapped[str | None] = mapped_column(String, nullable=True)
    strength: Mapped[float] = mapped_column(Float, default=1.0)
    emitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    geo: Mapped[str] = mapped_column(Geography(geometry_type="POINT", srid=4326))

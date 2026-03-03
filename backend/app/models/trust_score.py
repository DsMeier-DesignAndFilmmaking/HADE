import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class TrustScore(Base):
    __tablename__ = "trust_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    target_venue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("venues.id"))
    score: Mapped[float] = mapped_column(Float)
    contributing_signals: Mapped[list[str] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    network_depth: Mapped[int] = mapped_column(Integer, default=1)
    decay_rate: Mapped[float] = mapped_column(Float, default=0.01)

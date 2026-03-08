import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class MomentAction(StrEnum):
    ACCEPTED = "ACCEPTED"
    DISMISSED = "DISMISSED"
    IGNORED = "IGNORED"


class Moment(Base):
    __tablename__ = "moments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venue_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("venues.id"),
        nullable=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    context_state_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("context_states.id"),
    )
    opportunity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    action: Mapped[MomentAction] = mapped_column(
        Enum(MomentAction, name="momentaction"),
        default=MomentAction.IGNORED,
    )
    opportunity_score: Mapped[float] = mapped_column(Float)
    trust_score: Mapped[float] = mapped_column(Float)
    rationale: Mapped[str] = mapped_column(String)
    surfaced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    acted_on: Mapped[bool] = mapped_column(Boolean, default=False)
    acted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)

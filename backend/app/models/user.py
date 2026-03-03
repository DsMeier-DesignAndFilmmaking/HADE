import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, String, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    home_city: Mapped[str] = mapped_column(String(255), default="")
    preference_vector: Mapped[list[float] | None] = mapped_column(ARRAY(Float), nullable=True)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_active: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SocialEdge(Base):
    __tablename__ = "social_edges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_a: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    user_b: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    edge_weight: Mapped[float] = mapped_column(Float, default=1.0)
    mutual: Mapped[bool] = mapped_column(Boolean, default=False)
    established_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_interaction: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    signal_overlap_count: Mapped[int] = mapped_column(default=0)

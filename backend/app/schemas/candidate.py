from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import GeoLocation


class SignalBundle(BaseModel):
    user_first_name: str | None = None
    signal_type: str | None = None
    minutes_ago: int | None = None


class TrustContext(BaseModel):
    is_friend_checkin: bool = False
    operator_name: str | None = None
    interaction_type: str | None = None
    environmental_context: str | None = None
    relationship_label: str | None = None
    trust_multiplier: float | None = None
    # Backward compatibility for existing UI/prompt consumers.
    friend_name: str | None = None
    signal_text: str | None = None
    signal_bundle: SignalBundle | None = None


class CandidateSignal(BaseModel):
    signal_id: UUID
    signal_type: str
    source_user_id: UUID | None = None
    venue_id: UUID | None = None
    content: str | None = None
    emitted_at: datetime
    age_hours: float
    decay_strength: float
    freshness_multiplier: float
    effective_strength: float
    distance_to_venue_m: float | None = None
    binding_reason: Literal["venue_id_match", "floating_within_50m"]


class Candidate(BaseModel):
    place_id: str
    venue_name: str
    category: str
    geo: GeoLocation
    distance_meters: int
    eta_minutes: int
    score: float
    is_open_now: bool
    rating: float
    matched_signals: list[CandidateSignal] = Field(default_factory=list)
    trust_context: TrustContext = Field(default_factory=TrustContext)


class CandidateSet(BaseModel):
    context_state_id: UUID | None = None
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    candidates: list[Candidate] = Field(default_factory=list)

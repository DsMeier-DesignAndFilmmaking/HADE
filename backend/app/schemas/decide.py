from datetime import datetime
from uuid import UUID
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import GeoLocation
from app.schemas.event import EventInfo


class DecideRequest(BaseModel):
    geo: GeoLocation
    intent: str | None = None
    group_size: int = 1
    session_id: UUID | None = None
    # Added provider toggle: defaults to gemini, allows openai
    provider: Literal["gemini", "openai"] = Field(default="gemini", description="LLM provider for rationale generation")


class TrustAttribution(BaseModel):
    user_name: str
    signal_summary: str
    vibe_label: str


class PrimarySignal(BaseModel):
    user_name: str
    timestamp: datetime
    vibe_label: str
    comment: str


class OpportunityOut(BaseModel):
    id: UUID
    venue_name: str
    category: str
    distance_meters: int
    eta_minutes: int
    rationale: str
    trust_attributions: list[TrustAttribution]
    geo: GeoLocation
    is_primary: bool
    event: EventInfo | None = None
    primary_signal: PrimarySignal | None = None


class DecideResponse(BaseModel):
    primary: OpportunityOut
    fallbacks: list[OpportunityOut] = []
    context_state_id: UUID
    # Optional: tracks which model generated the content for testing/audit
    provider: str | None = None
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel


class MomentAction(StrEnum):
    ACCEPTED = "ACCEPTED"
    DISMISSED = "DISMISSED"
    IGNORED = "IGNORED"


class MomentCreate(BaseModel):
    context_state_id: UUID
    opportunity_id: UUID
    action: MomentAction
    venue_id: UUID | None = None


class MomentResponse(BaseModel):
    id: UUID
    context_state_id: UUID
    opportunity_id: UUID
    action: MomentAction
    acted_on: bool
    dismissed: bool
    acted_at: datetime | None
    surfaced_at: datetime

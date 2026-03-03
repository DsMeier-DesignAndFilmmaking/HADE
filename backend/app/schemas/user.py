from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: UUID
    username: str | None = None
    name: str
    home_city: str
    onboarding_complete: bool
    created_at: datetime
    last_active: datetime


class UserUpdate(BaseModel):
    name: str | None = None
    home_city: str | None = None


class SocialEdgeOut(BaseModel):
    user_id: UUID
    user_name: str
    edge_weight: float
    last_interaction: datetime


class TrustNetworkResponse(BaseModel):
    edges: list[SocialEdgeOut]

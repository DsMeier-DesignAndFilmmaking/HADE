"""Schemas for the analytics endpoints."""

from pydantic import BaseModel


class DDRResponse(BaseModel):
    accepted: int
    dismissed: int
    ignored: int
    total: int
    ddr_pct: float
    period_hours: int

from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel

T = TypeVar("T")


class GeoLocation(BaseModel):
    lat: float
    lng: float


class ErrorDetail(BaseModel):
    code: str
    message: str
    detail: str | None = None


class ResponseMeta(BaseModel):
    request_id: UUID
    latency_ms: int | None = None
    context_state_id: UUID | None = None


class ApiResponse(BaseModel, Generic[T]):
    status: str = "ok"
    data: T | None = None
    meta: ResponseMeta | None = None
    errors: list[ErrorDetail] = []

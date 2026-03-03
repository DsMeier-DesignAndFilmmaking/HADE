from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.schemas.common import ApiResponse

router = APIRouter(tags=["moments"])


@router.post("/moments/{moment_id}/act", response_model=ApiResponse[dict])
async def act_on_moment(
    moment_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Log that user acted on a recommendation."""
    # TODO: Mark moment as acted_on, log timestamp
    raise NotImplementedError


@router.post("/moments/{moment_id}/dismiss", response_model=ApiResponse[dict])
async def dismiss_moment(
    moment_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Log that user dismissed a recommendation."""
    # TODO: Mark moment as dismissed
    raise NotImplementedError

"""Guest session migration — reassigns anonymous context_states to authenticated user."""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth_context
from app.core.dependencies import get_db
from app.models.context_state import ContextState
from app.models.user import User
from app.schemas.common import ApiResponse, ResponseMeta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth-migration"])


class MigrateGuestRequest(BaseModel):
    guest_user_id: uuid.UUID


class MigrateGuestResponse(BaseModel):
    migrated_context_states: int


@router.post("/migrate-guest", response_model=ApiResponse[MigrateGuestResponse])
async def migrate_guest_session(
    body: MigrateGuestRequest,
    auth_ctx: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[MigrateGuestResponse]:
    """Migrate anonymous guest context_states to the newly authenticated user.

    Requires a non-anonymous authenticated session.
    """
    if auth_ctx.is_anonymous:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anonymous users cannot migrate sessions",
        )

    new_user_id = auth_ctx.user_id

    # Reassign context_states from the guest to the authenticated user
    result = await db.execute(
        update(ContextState)
        .where(ContextState.user_id == body.guest_user_id)
        .values(user_id=new_user_id)
    )
    migrated_count = result.rowcount

    # Clean up the anonymous user row
    await db.execute(
        delete(User).where(User.id == body.guest_user_id)
    )

    await db.commit()

    logger.info(
        "[HADE MIGRATION] Migrated %d context_states from %s to %s",
        migrated_count,
        body.guest_user_id,
        new_user_id,
    )

    return ApiResponse(
        status="ok",
        data=MigrateGuestResponse(migrated_context_states=migrated_count),
        meta=ResponseMeta(request_id=uuid.uuid4()),
    )

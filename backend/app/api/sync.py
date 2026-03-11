"""Supabase → HADE user synchronization.

Called by the mobile app after a successful Supabase OTP login.
Verifies the Supabase JWT, upserts the HADE User row, and returns
the canonical HADE user profile.
"""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.core.dependencies import get_db
from app.models.user import User
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.user import UserResponse

# Setup basic logging for the Engine
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth-sync"])

class SyncRequest(BaseModel):
    username: str | None = None
    name: str | None = None

@router.post("/sync", response_model=ApiResponse[UserResponse])
async def sync_user(
    body: SyncRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[UserResponse]:
    """Synchronize a Supabase-authenticated user with the HADE database.

    ``get_current_user_id`` (deps.py) always auto-provisions the HADE user row
    before this handler is called, so ``user`` should never be None here.
    If it is, that indicates a data-integrity problem worth surfacing clearly.
    """
    logger.info("[HADE SYNC] Processing sync for user_id: %s", user_id)

    # 1. FETCH LOCAL USER (always exists — provisioned by deps.py in this request)
    user = await db.get(User, user_id)

    if user is None:
        # This should never happen: deps.py commits the user before we get here.
        # Surface it as a 500 so it is visible in logs rather than silently
        # attempting to create a duplicate with incorrect field values.
        logger.error(
            "[HADE SYNC] User %s not found after auth validation — data integrity error",
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User record not found after authentication",
        )

    # 2. METADATA UPDATES
    if body.name is not None:
        user.name = body.name.strip()

    if body.username is not None:
        clean_username = body.username.strip().lower()
        if clean_username:
            # Check for username collisions
            stmt = select(User).where(User.username == clean_username, User.id != user_id)
            result = await db.execute(stmt)
            if result.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username already taken",
                )
            user.username = clean_username
            user.onboarding_complete = True

    # 4. PERSIST CHANGES
    try:
        await db.commit()
        await db.refresh(user)
    except Exception as e:
        await db.rollback()
        logger.error(f"[HADE SYNC] Database Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to synchronize user data"
        )

    return ApiResponse(
        status="ok",
        data=UserResponse(
            id=user.id,
            username=user.username,
            name=user.name,
            email=user.email,
            home_city=user.home_city,
            onboarding_complete=user.onboarding_complete,
            created_at=user.created_at,
            last_active=user.last_active,
        ),
        meta=ResponseMeta(request_id=uuid.uuid4()),
    )
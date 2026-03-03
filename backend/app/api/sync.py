"""Supabase → HADE user synchronization.

Called by the mobile app after a successful Supabase OTP login.
Verifies the Supabase JWT, upserts the HADE User row, and returns
the canonical HADE user profile.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.core.dependencies import get_db
from app.models.user import User
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.user import UserResponse

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

    This is a true upsert — always updates name/username if provided,
    even if they were previously set.
    """
    print(f"DEBUG: Sync Request Received — user_id={user_id}, body={body}")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found after provisioning",
        )

    # Update name if provided
    if body.name is not None:
        user.name = body.name.strip()

    # Update username if provided — check uniqueness first
    if body.username is not None:
        clean_username = body.username.strip().lower()
        if clean_username:
            existing = await db.execute(
                select(User).where(
                    User.username == clean_username,
                    User.id != user_id,
                )
            )
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username already taken",
                )
            user.username = clean_username

    # Mark onboarding complete once a username is set (name is optional)
    if user.username:
        user.onboarding_complete = True

    await db.commit()
    await db.refresh(user)

    return ApiResponse(
        status="ok",
        data=UserResponse(
            id=user.id,
            username=user.username,
            name=user.name,
            home_city=user.home_city,
            onboarding_complete=user.onboarding_complete,
            created_at=user.created_at,
            last_active=user.last_active,
        ),
        meta=ResponseMeta(request_id=uuid.uuid4()),
    )

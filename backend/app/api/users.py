import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.models.user import User
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.user import TrustNetworkResponse, UserResponse, UserUpdate

router = APIRouter(tags=["users"])


@router.get("/user/me", response_model=ApiResponse[UserResponse])
async def get_me(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[UserResponse]:
    """User profile and preference state."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

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


@router.put("/user/me", response_model=ApiResponse[UserResponse])
async def update_me(
    payload: UserUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[UserResponse]:
    """Update profile or preferences."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.name is not None:
        user.name = payload.name
    if payload.home_city is not None:
        user.home_city = payload.home_city

    await db.commit()
    await db.refresh(user)

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


@router.get("/user/trust-network", response_model=ApiResponse[TrustNetworkResponse])
async def get_trust_network(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[TrustNetworkResponse]:
    """Social graph for current user."""
    # TODO: Fetch trust network edges
    return ApiResponse(
        status="ok",
        data=TrustNetworkResponse(edges=[]),
        meta=ResponseMeta(request_id=uuid.uuid4()),
    )

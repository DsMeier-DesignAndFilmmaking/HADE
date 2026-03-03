"""Dev-mode authentication endpoints.

These bypass Supabase and issue JWTs directly for local development.
Do NOT deploy to production — use Supabase Auth instead.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db
from app.models.user import User
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth/dev", tags=["auth-dev"])


class PhoneRequest(BaseModel):
    phone: str


class VerifyRequest(BaseModel):
    phone: str
    token: str


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse


# In dev mode, OTP is always "000000"
DEV_OTP = "000000"

# In-memory store of pending OTPs (phone → True)
_pending_otps: dict[str, bool] = {}


def _create_tokens(user_id: uuid.UUID) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    access_payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expiry_minutes),
        "type": "access",
    }
    refresh_payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=30),
        "type": "refresh",
    }
    access_token = jwt.encode(access_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    refresh_token = jwt.encode(
        refresh_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    return access_token, refresh_token


@router.post("/send-otp")
async def send_otp(
    body: PhoneRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict[str, str]]:
    """Send OTP to phone. In dev mode, OTP is always 000000."""
    _pending_otps[body.phone] = True
    return ApiResponse(
        status="ok",
        data={"message": f"OTP sent to {body.phone}. Dev OTP: {DEV_OTP}"},
        meta=ResponseMeta(request_id=uuid.uuid4()),
    )


@router.post("/verify-otp")
async def verify_otp(
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[AuthTokens]:
    """Verify OTP and return tokens. Creates user if first login."""
    if body.phone not in _pending_otps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP requested for this phone. Call /send-otp first.",
        )

    if body.token != DEV_OTP:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP.",
        )

    # Clear pending OTP
    del _pending_otps[body.phone]

    # Find or create user
    result = await db.execute(select(User).where(User.phone == body.phone))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(phone=body.phone, name="", home_city="")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token, refresh_token = _create_tokens(user.id)

    user_response = UserResponse(
        id=user.id,
        name=user.name,
        home_city=user.home_city,
        onboarding_complete=user.onboarding_complete,
        created_at=user.created_at,
        last_active=user.last_active,
    )

    return ApiResponse(
        status="ok",
        data=AuthTokens(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user_response,
        ),
        meta=ResponseMeta(request_id=uuid.uuid4()),
    )

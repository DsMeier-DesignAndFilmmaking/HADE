"""FastAPI dependencies for auth — dual JWT validation (dev HS256 + Supabase ES256 via JWKS)."""

import logging
import time
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer()

# ---------------------------------------------------------------------------
# JWKS cache — Supabase signs tokens with ES256, we need the public key
# ---------------------------------------------------------------------------
_jwks_cache: dict[str, object] | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SECONDS = 3600


async def _get_supabase_jwks() -> dict[str, object] | None:
    """Fetch and cache the Supabase JWKS keyset."""
    global _jwks_cache, _jwks_fetched_at

    if _jwks_cache is not None and (time.monotonic() - _jwks_fetched_at) < _JWKS_TTL_SECONDS:
        return _jwks_cache

    if not settings.supabase_url:
        return None

    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_fetched_at = time.monotonic()
        print(f"[JWKS] Fetched from {url}: {_jwks_cache}")
        return _jwks_cache
    except Exception as e:
        print(f"[JWKS] Failed to fetch from {url}: {e}")
        return _jwks_cache


# ---------------------------------------------------------------------------
# Token decoders
# ---------------------------------------------------------------------------

def _try_decode_dev_jwt(token: str) -> UUID | None:
    """Decode a dev-issued HS256 JWT. Returns HADE user UUID or None."""
    if not settings.jwt_secret:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        sub = payload.get("sub")
        if sub is None:
            return None
        return UUID(sub)
    except (JWTError, ValueError):
        return None


async def _try_decode_supabase_jwt(token: str) -> tuple[str, str | None] | None:
    """Decode a Supabase-issued ES256 JWT using the JWKS public key."""

    # Peek at the token header
    try:
        header = jwt.get_unverified_header(token)
        print(f"[SUPABASE AUTH] Token header: {header}")
    except Exception as e:
        print(f"[SUPABASE AUTH] Cannot read token header: {e}")
        return None

    token_alg = header.get("alg", "unknown")
    token_kid = header.get("kid")
    print(f"[SUPABASE AUTH] Token alg={token_alg}, kid={token_kid}")

    # Fetch JWKS
    jwks_data = await _get_supabase_jwks()
    if jwks_data is None:
        print("[SUPABASE AUTH] No JWKS available — cannot verify")
        return None

    # Find the matching signing key
    keys = jwks_data.get("keys", [])
    if not isinstance(keys, list):
        print(f"[SUPABASE AUTH] JWKS 'keys' is not a list: {type(keys)}")
        return None

    signing_key = None
    for key_data in keys:
        if not isinstance(key_data, dict):
            continue
        # Match by kid if present, otherwise take first sig key
        if token_kid is not None and key_data.get("kid") != token_kid:
            continue
        if key_data.get("use", "sig") == "sig":
            try:
                signing_key = jwk.construct(key_data)
                print(f"[SUPABASE AUTH] Found matching JWKS key: kid={key_data.get('kid')}")
                break
            except Exception as e:
                print(f"[SUPABASE AUTH] Failed to construct key: {e}")
                continue

    if signing_key is None:
        print(f"[SUPABASE AUTH] No matching key found in JWKS for kid={token_kid}")
        return None

    # Decode with ES256
    try:
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
        print(f"[SUPABASE AUTH] Decoded Payload: {payload}")
    except Exception as e:
        print(f"[SUPABASE AUTH] JWT_ERROR_DETAIL: {type(e).__name__}: {e}")
        return None

    sub = payload.get("sub")
    if sub is None:
        print("[SUPABASE AUTH] Token decoded but missing 'sub' claim")
        return None

    phone: str | None = payload.get("phone")
    print(f"[SUPABASE AUTH] SUCCESS — sub={sub}, phone={phone}")
    return (sub, phone)


# ---------------------------------------------------------------------------
# Auto-provisioning
# ---------------------------------------------------------------------------

async def _get_or_create_user_for_supabase(
    db: AsyncSession,
    supabase_id: str,
    phone: str | None,
) -> UUID:
    """Look up a HADE user by ``supabase_id``, or auto-provision one."""
    # 1. Direct lookup by supabase_id
    result = await db.execute(select(User).where(User.supabase_id == supabase_id))
    user = result.scalar_one_or_none()
    if user is not None:
        return user.id

    # 2. Link by phone (existing dev-created user)
    if phone:
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
        if user is not None:
            user.supabase_id = supabase_id
            await db.commit()
            logger.info("Linked supabase_id %s to existing user %s via phone", supabase_id, user.id)
            return user.id

    # 3. Auto-provision new user
    new_user = User(phone=phone or "", supabase_id=supabase_id)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    logger.info("Auto-provisioned user %s for supabase_id %s", new_user.id, supabase_id)
    return new_user.id


# ---------------------------------------------------------------------------
# Public FastAPI dependency
# ---------------------------------------------------------------------------

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """Validate JWT and return the authenticated HADE user ID.

    Tries dev JWT (HS256) first, then Supabase JWT (ES256 via JWKS).
    On first Supabase login the HADE user is auto-provisioned.
    """
    token = credentials.credentials
    print(f"\n[AUTH] === get_current_user_id called ===")
    print(f"[AUTH] Incoming Token: {token[:20]}...")

    # Dev JWT
    dev_user_id = _try_decode_dev_jwt(token)
    if dev_user_id is not None:
        print(f"[AUTH] Dev JWT matched — user_id={dev_user_id}")
        return dev_user_id

    print("[AUTH] Dev JWT did not match, trying Supabase JWT (ES256 via JWKS)...")

    # Supabase JWT
    supabase_result = await _try_decode_supabase_jwt(token)
    if supabase_result is not None:
        supabase_id, phone = supabase_result
        print(f"[AUTH] Supabase JWT matched — provisioning HADE user...")
        hade_user_id = await _get_or_create_user_for_supabase(db, supabase_id, phone)
        print(f"[AUTH] HADE user_id={hade_user_id}")
        return hade_user_id

    print("[AUTH] Both dev and Supabase JWT failed — returning 401")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
    )

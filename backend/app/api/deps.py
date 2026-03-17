"""FastAPI dependencies for auth — dual JWT validation (dev HS256 + Supabase ES256 via JWKS)."""

from dataclasses import dataclass
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
_JWKS_TTL_SECONDS = 3600   # re-fetch the full keyset every hour
_JWKS_RETRY_SECONDS = 30   # but retry quickly after a transient failure

_jwks_cache: dict[str, object] | None = None
_jwks_fetched_at: float = 0.0
_jwks_last_failed_at: float = 0.0  # distinguish "never tried" from "failed"


@dataclass(frozen=True)
class AuthContext:
    """Authenticated request context resolved from JWT claims."""

    user_id: UUID
    is_anonymous: bool = False


async def _get_supabase_jwks() -> dict[str, object] | None:
    """Fetch and cache the Supabase JWKS keyset.

    Uses a two-tier TTL:
    - On success: keyset is cached for ``_JWKS_TTL_SECONDS`` (1 hour).
    - On failure: retries after ``_JWKS_RETRY_SECONDS`` (30 s) so a transient
      network hiccup at startup does not block all Supabase JWT validation for
      the remainder of the hour.
    """
    global _jwks_cache, _jwks_fetched_at, _jwks_last_failed_at

    now = time.monotonic()

    # Serve from cache if it is still fresh.
    if _jwks_cache is not None and (now - _jwks_fetched_at) < _JWKS_TTL_SECONDS:
        return _jwks_cache

    # If the last fetch failed, respect the retry back-off window.
    if _jwks_cache is None and _jwks_last_failed_at > 0:
        if (now - _jwks_last_failed_at) < _JWKS_RETRY_SECONDS:
            logger.debug("JWKS fetch skipped — in retry back-off window")
            return None

    if not settings.supabase_url:
        return None

    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_fetched_at = now
        _jwks_last_failed_at = 0.0  # reset failure clock on success
        logger.info("JWKS fetched from %s", url)
        return _jwks_cache
    except Exception as e:
        _jwks_last_failed_at = now
        logger.warning(
            "JWKS fetch failed from %s: %s — will retry in %ds",
            url, e, _JWKS_RETRY_SECONDS,
        )
        return _jwks_cache  # return stale cache rather than None on transient failures


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


async def _try_decode_supabase_jwt(
    token: str,
) -> tuple[str, str | None, str | None, bool] | None:
    """Decode a Supabase-issued ES256 JWT using the JWKS public key.

    Returns ``(supabase_id, phone, email, is_anonymous)`` on success, or ``None``.
    """

    # Peek at the token header
    try:
        header = jwt.get_unverified_header(token)
    except Exception:
        logger.debug("Cannot read Supabase token header")
        return None

    token_alg = header.get("alg", "unknown")
    token_kid = header.get("kid")
    logger.debug("Supabase token alg=%s, kid=%s", token_alg, token_kid)

    # Fetch JWKS
    jwks_data = await _get_supabase_jwks()
    if jwks_data is None:
        logger.debug("No JWKS available — cannot verify Supabase token")
        return None

    # Find the matching signing key
    keys = jwks_data.get("keys", [])
    if not isinstance(keys, list):
        logger.debug("JWKS 'keys' is not a list: %s", type(keys))
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
                break
            except Exception:
                continue

    if signing_key is None:
        logger.debug("No matching JWKS key for kid=%s", token_kid)
        return None

    # Decode with ES256
    try:
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
    except Exception as e:
        logger.debug("Supabase JWT verification failed: %s", type(e).__name__)
        return None

    sub = payload.get("sub")
    if sub is None:
        logger.debug("Supabase token missing 'sub' claim")
        return None

    phone: str | None = payload.get("phone")
    email: str | None = payload.get("email")
    app_metadata = payload.get("app_metadata", {})
    provider = app_metadata.get("provider") if isinstance(app_metadata, dict) else None
    is_anonymous = bool(payload.get("is_anonymous", False) or provider == "anonymous")
    logger.info("Supabase ES256 auth resolved: sub=%s anonymous=%s", sub, is_anonymous)
    return (sub, phone, email, is_anonymous)


# ---------------------------------------------------------------------------
# Auto-provisioning
# ---------------------------------------------------------------------------

async def _get_or_create_user_for_supabase(
    db: AsyncSession,
    supabase_id: str,
    phone: str | None,
    email: str | None = None,
    is_anonymous: bool = False,
) -> UUID:
    """Look up a HADE user by ``supabase_id``, or auto-provision one.

    Supports both phone-based and email-based Supabase auth.
    """
    # 1. Direct lookup by supabase_id
    result = await db.execute(select(User).where(User.supabase_id == supabase_id))
    user = result.scalar_one_or_none()
    if user is not None:
        should_commit = False
        # Back-fill email if it was missing (e.g. user upgraded from phone to email)
        if email and not user.email:
            user.email = email
            should_commit = True
        # Anonymous sessions are zero-input and should not be forced through onboarding.
        if is_anonymous and not user.username:
            user.onboarding_complete = True
            should_commit = True
        if should_commit:
            await db.commit()
        return user.id

    # 2. Link by phone (existing dev-created user)
    if phone:
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
        if user is not None:
            user.supabase_id = supabase_id
            if email and not user.email:
                user.email = email
            if is_anonymous and not user.username:
                user.onboarding_complete = True
            await db.commit()
            logger.info("Linked supabase_id %s to existing user %s via phone", supabase_id, user.id)
            return user.id

    # 3. Link by email (existing user who signed up with email)
    if email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is not None:
            user.supabase_id = supabase_id
            if is_anonymous and not user.username:
                user.onboarding_complete = True
            await db.commit()
            logger.info("Linked supabase_id %s to existing user %s via email", supabase_id, user.id)
            return user.id

    # 4. Auto-provision new user
    # phone and email are nullable — only set them if actually provided
    new_user = User(
        phone=phone or None,
        email=email or None,
        supabase_id=supabase_id,
        onboarding_complete=is_anonymous,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    logger.info("Auto-provisioned user %s for supabase_id %s", new_user.id, supabase_id)
    return new_user.id


async def _resolve_auth_context(token: str, db: AsyncSession) -> AuthContext | None:
    """Resolve request auth context from either dev JWT or Supabase JWT."""
    dev_user_id = _try_decode_dev_jwt(token)
    if dev_user_id is not None:
        # Ensure the dev user row exists so FK constraints on context_states,
        # opportunities, etc. never fire.  This is idempotent — the SELECT is
        # free after the first call and adds no latency to normal requests.
        result = await db.execute(select(User).where(User.id == dev_user_id))
        if result.scalar_one_or_none() is None:
            db.add(User(
                id=dev_user_id,
                name="Dev User",
                home_city="Denver",
                onboarding_complete=True,
            ))
            await db.commit()
            logger.info("Auto-provisioned dev user id=%s", dev_user_id)
        return AuthContext(user_id=dev_user_id, is_anonymous=False)

    supabase_result = await _try_decode_supabase_jwt(token)
    if supabase_result is None:
        return None

    supabase_id, phone, email, is_anonymous = supabase_result
    hade_user_id = await _get_or_create_user_for_supabase(
        db,
        supabase_id=supabase_id,
        phone=phone,
        email=email,
        is_anonymous=is_anonymous,
    )
    return AuthContext(user_id=hade_user_id, is_anonymous=is_anonymous)


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

    auth_context = await _resolve_auth_context(token, db)
    if auth_context is not None:
        return auth_context.user_id

    logger.warning("Auth failed — returning 401")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
    )


async def get_current_auth_context(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    """Validate JWT and return resolved auth context (including anonymous flag)."""
    token = credentials.credentials

    auth_context = await _resolve_auth_context(token, db)
    if auth_context is not None:
        return auth_context

    logger.warning("Auth failed — returning 401")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
    )

"""Supabase → HADE user synchronization.

Called by the mobile app after a successful Supabase OTP login.
Verifies the Supabase JWT, upserts the HADE User row, and returns
the canonical HADE user profile.
"""

import hashlib
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.core.dependencies import get_db
from app.models.user import User, SocialEdge
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


# ---------------------------------------------------------------------------
# Contact sync — seeds the trust graph (SocialEdge table)
# ---------------------------------------------------------------------------

# Hard cap to prevent abuse; a typical contacts list is 200–500 entries.
_MAX_HASHES_PER_REQUEST = 5000


class SyncContactsRequest(BaseModel):
    """Client sends SHA-256 hex-digest hashes of E.164 phone numbers.

    Raw numbers never leave the device — only their SHA-256 hashes are
    transmitted.  The backend hashes its own stored phone values to find
    matches, so no plaintext phone numbers cross the wire.
    """

    phone_hashes: list[str] = Field(
        ...,
        min_length=1,
        max_length=_MAX_HASHES_PER_REQUEST,
        description="SHA-256 hex-digests of E.164-normalised phone numbers",
    )


class SyncContactsResponse(BaseModel):
    edges_created: int
    edges_mutual: int


def _hash_phone(phone: str) -> str:
    """SHA-256 hex-digest of an E.164 phone string, matching the client hash."""
    return hashlib.sha256(phone.encode()).hexdigest()


@router.post(
    "/sync-contacts",
    response_model=ApiResponse[SyncContactsResponse],
)
async def sync_contacts(
    body: SyncContactsRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SyncContactsResponse]:
    """Match hashed phone contacts against existing HADE users and create
    SocialEdge rows to seed the trust graph.

    Privacy guarantees
    ──────────────────
    • Only SHA-256 hashes of E.164 numbers are accepted; the backend never
      receives raw contact phone numbers.
    • Matching is performed by hashing the phone numbers already stored in
      the ``users`` table (which came from the auth layer, not from this
      endpoint).
    • No contact data is persisted — only the resulting ``SocialEdge``
      rows (user-to-user links).
    """
    incoming_hashes = set(body.phone_hashes)

    # 1. Load all HADE users who have a phone number (excluding self).
    result = await db.execute(
        select(User.id, User.phone).where(
            User.phone.isnot(None),
            User.id != user_id,
        )
    )
    rows = result.all()

    # 2. Hash each stored phone and intersect with the incoming set.
    matched_user_ids: list[uuid.UUID] = []
    for row in rows:
        if row.phone and _hash_phone(row.phone) in incoming_hashes:
            matched_user_ids.append(row.id)

    if not matched_user_ids:
        return ApiResponse(
            status="ok",
            data=SyncContactsResponse(edges_created=0, edges_mutual=0),
            meta=ResponseMeta(request_id=uuid.uuid4()),
        )

    # 3. Load existing edges involving the requesting user and matched users
    #    so we can upsert without duplicates and detect mutual edges.
    existing_edges_result = await db.execute(
        select(SocialEdge).where(
            or_(
                and_(
                    SocialEdge.user_a == user_id,
                    SocialEdge.user_b.in_(matched_user_ids),
                ),
                and_(
                    SocialEdge.user_a.in_(matched_user_ids),
                    SocialEdge.user_b == user_id,
                ),
            )
        )
    )
    existing_edges = existing_edges_result.scalars().all()

    # Build lookup sets for fast membership tests.
    forward_set: set[uuid.UUID] = set()   # edges where user_a == me
    reverse_set: set[uuid.UUID] = set()   # edges where user_b == me (other→me)
    for edge in existing_edges:
        if edge.user_a == user_id:
            forward_set.add(edge.user_b)
        else:
            reverse_set.add(edge.user_a)

    now = datetime.now(timezone.utc)
    edges_created = 0
    edges_mutual = 0

    for matched_id in matched_user_ids:
        # Skip if we already have a forward edge (me→them).
        if matched_id in forward_set:
            continue

        # Does the reverse edge (them→me) already exist?
        is_mutual = matched_id in reverse_set

        # Create forward edge me→them.
        db.add(SocialEdge(
            user_a=user_id,
            user_b=matched_id,
            mutual=is_mutual,
            edge_weight=1.0,
            established_at=now,
            last_interaction=now,
        ))
        edges_created += 1

        # If reverse edge exists, upgrade it to mutual.
        if is_mutual:
            for edge in existing_edges:
                if edge.user_a == matched_id and edge.user_b == user_id:
                    edge.mutual = True
                    edge.last_interaction = now
                    break
            edges_mutual += 1

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error("[CONTACTS SYNC] DB error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync contacts",
        )

    logger.info(
        "[CONTACTS SYNC] user=%s matched=%d created=%d mutual=%d",
        user_id, len(matched_user_ids), edges_created, edges_mutual,
    )

    return ApiResponse(
        status="ok",
        data=SyncContactsResponse(
            edges_created=edges_created,
            edges_mutual=edges_mutual,
        ),
        meta=ResponseMeta(request_id=uuid.uuid4()),
    )
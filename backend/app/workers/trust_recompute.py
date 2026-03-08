"""Trust recomputation helpers and Celery task for acceptance feedback."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import create_engine, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.trust_score import TrustScore
from app.models.user import SocialEdge
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

ACCEPT_TRUST_BOOST = 0.03
BASE_TRUST_SCORE = 1.0
MAX_TRUST_SCORE = 5.0

_sync_engine = None


def _get_engine():
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = create_engine(settings.sync_database_url)
    return _sync_engine


def _clamp_score(value: float) -> float:
    return max(0.0, min(MAX_TRUST_SCORE, value))


def _network_neighbor_ids_sync(session: Session, source_user_id: UUID) -> set[UUID]:
    edges = session.execute(
        select(SocialEdge).where(
            or_(
                SocialEdge.user_a == source_user_id,
                SocialEdge.user_b == source_user_id,
            )
        )
    ).scalars().all()

    neighbor_ids: set[UUID] = set()
    for edge in edges:
        neighbor_ids.add(edge.user_b if edge.user_a == source_user_id else edge.user_a)
    return neighbor_ids


async def _network_neighbor_ids_async(db: AsyncSession, source_user_id: UUID) -> set[UUID]:
    result = await db.execute(
        select(SocialEdge).where(
            or_(
                SocialEdge.user_a == source_user_id,
                SocialEdge.user_b == source_user_id,
            )
        )
    )
    edges = result.scalars().all()

    neighbor_ids: set[UUID] = set()
    for edge in edges:
        neighbor_ids.add(edge.user_b if edge.user_a == source_user_id else edge.user_a)
    return neighbor_ids


def _apply_score_boost_sync(
    session: Session,
    network_user_id: UUID,
    venue_id: UUID,
    now: datetime,
) -> bool:
    existing = session.execute(
        select(TrustScore).where(
            TrustScore.source_user_id == network_user_id,
            TrustScore.target_venue_id == venue_id,
        )
    ).scalar_one_or_none()

    if existing is None:
        session.add(
            TrustScore(
                source_user_id=network_user_id,
                target_venue_id=venue_id,
                score=_clamp_score(BASE_TRUST_SCORE + ACCEPT_TRUST_BOOST),
                contributing_signals=None,
                computed_at=now,
                network_depth=1,
                decay_rate=0.01,
            )
        )
        return True

    next_score = _clamp_score(existing.score + ACCEPT_TRUST_BOOST)
    if next_score == existing.score:
        return False
    existing.score = next_score
    existing.computed_at = now
    return True


async def _apply_score_boost_async(
    db: AsyncSession,
    network_user_id: UUID,
    venue_id: UUID,
    now: datetime,
) -> bool:
    result = await db.execute(
        select(TrustScore).where(
            TrustScore.source_user_id == network_user_id,
            TrustScore.target_venue_id == venue_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing is None:
        db.add(
            TrustScore(
                source_user_id=network_user_id,
                target_venue_id=venue_id,
                score=_clamp_score(BASE_TRUST_SCORE + ACCEPT_TRUST_BOOST),
                contributing_signals=None,
                computed_at=now,
                network_depth=1,
                decay_rate=0.01,
            )
        )
        return True

    next_score = _clamp_score(existing.score + ACCEPT_TRUST_BOOST)
    if next_score == existing.score:
        return False
    existing.score = next_score
    existing.computed_at = now
    return True


def apply_acceptance_boost_sync(
    session: Session,
    venue_id: UUID,
    source_user_id: UUID,
) -> int:
    """Slightly boost trust scores for source user's network at the accepted venue."""
    neighbor_ids = _network_neighbor_ids_sync(session, source_user_id)
    if not neighbor_ids:
        return 0

    now = datetime.now(UTC)
    updates = 0
    for neighbor_id in neighbor_ids:
        if _apply_score_boost_sync(session, neighbor_id, venue_id, now):
            updates += 1
    return updates


async def boost_network_trust_scores_async(
    db: AsyncSession,
    venue_id: UUID,
    source_user_id: UUID,
) -> int:
    """Async trust-score boost used by API handlers."""
    neighbor_ids = await _network_neighbor_ids_async(db, source_user_id)
    if not neighbor_ids:
        return 0

    now = datetime.now(UTC)
    updates = 0
    for neighbor_id in neighbor_ids:
        if await _apply_score_boost_async(db, neighbor_id, venue_id, now):
            updates += 1
    return updates


@celery_app.task
def recompute_trust_scores(venue_id: str, source_user_id: str) -> int:
    """Celery entrypoint for acceptance-based trust boosts."""
    venue_uuid = UUID(venue_id)
    source_uuid = UUID(source_user_id)

    with Session(_get_engine()) as session:
        updates = apply_acceptance_boost_sync(
            session=session,
            venue_id=venue_uuid,
            source_user_id=source_uuid,
        )
        session.commit()

    if updates:
        logger.info(
            "trust_recompute: boosted trust scores for venue=%s source_user=%s count=%d",
            venue_id,
            source_user_id,
            updates,
        )
    return updates

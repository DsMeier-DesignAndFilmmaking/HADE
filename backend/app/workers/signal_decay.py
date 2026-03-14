"""Celery task: expire stale signals past their TTL."""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, delete, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.signal import Signal, SignalType
from app.services.trust import PURGE_SIGNAL_CUTOFF_HOURS
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

_sync_engine = None

# Cliff-edge boundary (hours) — signals older than this are in the cliff-edge zone.
_CLIFF_EDGE_HOURS = 4.0
# Freshness boundary (minutes) — signals younger than this get a 1.3x boost.
_FRESH_MINUTES = 45.0


def _get_engine():
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = create_engine(settings.sync_database_url)
    return _sync_engine


def _log_decay_audit(session: Session, now: datetime) -> None:
    """Log a distribution of live signals across decay stages and types."""
    purge_cutoff = now - timedelta(hours=PURGE_SIGNAL_CUTOFF_HOURS)
    fresh_cutoff = now - timedelta(minutes=_FRESH_MINUTES)
    cliff_cutoff = now - timedelta(hours=_CLIFF_EDGE_HOURS)

    # Count live signals (not yet expired, not yet purge-age) by type.
    rows = session.execute(
        select(Signal.type, func.count().label("n"))
        .where(
            Signal.expires_at > now,
            Signal.emitted_at >= purge_cutoff,
        )
        .group_by(Signal.type)
    ).all()

    total_live = sum(r.n for r in rows)
    if not total_live:
        logger.info("[SIGNAL DECAY AUDIT] No live signals")
        return

    by_type = {r.type: r.n for r in rows}
    logger.info("[SIGNAL DECAY AUDIT] Live signals by type: %s", {t.value: n for t, n in by_type.items()})

    # Count by decay stage (across all types).
    fresh_count = session.scalar(
        select(func.count()).where(
            Signal.expires_at > now,
            Signal.emitted_at >= fresh_cutoff,
        )
    ) or 0
    cliff_count = session.scalar(
        select(func.count()).where(
            Signal.expires_at > now,
            Signal.emitted_at >= purge_cutoff,
            Signal.emitted_at < cliff_cutoff,
        )
    ) or 0
    decaying_count = total_live - fresh_count - cliff_count

    logger.info(
        "[SIGNAL DECAY AUDIT] Stages — fresh(≤45m): %d  decaying: %d  cliff-edge(>4h): %d  total: %d",
        fresh_count,
        max(0, decaying_count),
        cliff_count,
        total_live,
    )


@celery_app.task
def expire_stale_signals() -> int:
    """Delete signals where expires_at < now. Returns count of expired signals."""
    now = datetime.now(timezone.utc)
    with Session(_get_engine()) as session:
        _log_decay_audit(session, now)

        result = session.execute(
            delete(Signal).where(Signal.expires_at < now)
        )
        count = result.rowcount
        session.commit()

    if count:
        logger.info("[SIGNAL DECAY] Expired %d stale signals", count)
    return count

"""Celery task: expire stale signals past their TTL."""

import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.signal import Signal
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

_sync_engine = None


def _get_engine():
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = create_engine(settings.sync_database_url)
    return _sync_engine


@celery_app.task
def expire_stale_signals() -> int:
    """Delete signals where expires_at < now. Returns count of expired signals."""
    now = datetime.now(timezone.utc)
    with Session(_get_engine()) as session:
        result = session.execute(
            delete(Signal).where(Signal.expires_at < now)
        )
        count = result.rowcount
        session.commit()
    if count:
        logger.info("Expired %d stale signals", count)
    return count

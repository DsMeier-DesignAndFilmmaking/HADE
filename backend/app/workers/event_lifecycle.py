"""Celery task: manage micro event lifecycle transitions.

Transitions events:
- UPCOMING → LIVE when starts_at has passed
- LIVE → ENDED when expires_at has passed
- Expires signals associated with ended events
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.micro_event import EventStatus, MicroEvent
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
def transition_event_statuses() -> dict[str, int]:
    """Transition events based on their timestamps.

    Returns counts of transitioned events.
    """
    now = datetime.now(timezone.utc)
    counts = {"to_live": 0, "to_ended": 0}

    with Session(_get_engine()) as session:
        # UPCOMING → LIVE when starts_at <= now
        result = session.execute(
            update(MicroEvent)
            .where(MicroEvent.status == EventStatus.UPCOMING)
            .where(MicroEvent.starts_at <= now)
            .values(status=EventStatus.LIVE)
        )
        counts["to_live"] = result.rowcount

        # Find LIVE events that should end
        ended_ids_result = session.execute(
            select(MicroEvent.id)
            .where(MicroEvent.status == EventStatus.LIVE)
            .where(MicroEvent.expires_at <= now)
        )
        ended_ids = [row[0] for row in ended_ids_result.all()]
        counts["to_ended"] = len(ended_ids)

        if ended_ids:
            # LIVE → ENDED
            session.execute(
                update(MicroEvent)
                .where(MicroEvent.id.in_(ended_ids))
                .values(status=EventStatus.ENDED)
            )
            # Expire signals associated with ended events
            session.execute(
                update(Signal)
                .where(Signal.event_id.in_(ended_ids))
                .where(Signal.expires_at > now)
                .values(expires_at=now)
            )

        session.commit()

    if counts["to_live"] or counts["to_ended"]:
        logger.info(
            "Event transitions: %d→LIVE, %d→ENDED",
            counts["to_live"],
            counts["to_ended"],
        )

    return counts

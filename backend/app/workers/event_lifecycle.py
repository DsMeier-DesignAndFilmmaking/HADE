"""Celery task: manage micro event lifecycle transitions.

Transitions events:
- UPCOMING → LIVE when starts_at has passed
- LIVE → ENDED when expires_at has passed
"""

from app.workers.celery_app import celery_app


@celery_app.task
def transition_event_statuses() -> dict[str, int]:
    """Transition events based on their timestamps.

    Returns counts of transitioned events.
    """
    # TODO: Query UPCOMING events where starts_at <= now → set status = LIVE
    # TODO: Query LIVE events where expires_at <= now → set status = ENDED
    # TODO: For ENDED events, expire associated signals (set expires_at = now)
    raise NotImplementedError

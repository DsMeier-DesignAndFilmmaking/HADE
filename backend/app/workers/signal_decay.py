"""Celery task: expire stale signals past their TTL."""

from app.workers.celery_app import celery_app


@celery_app.task
def expire_stale_signals() -> int:
    """Delete signals where expires_at < now. Returns count of expired signals."""
    # TODO: Query and delete expired signals
    # TODO: Update related venue.last_signal_at if needed
    raise NotImplementedError

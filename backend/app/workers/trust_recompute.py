"""Celery task: recompute TrustScores when new signals arrive."""

from uuid import UUID

from app.workers.celery_app import celery_app


@celery_app.task
def recompute_trust_scores(venue_id: str, source_user_id: str) -> None:
    """Recompute TrustScores for a venue after a new signal is emitted."""
    # TODO: Load affected users in trust network
    # TODO: Recompute scores with updated signals
    # TODO: Persist updated TrustScores
    raise NotImplementedError

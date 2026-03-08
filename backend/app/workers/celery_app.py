from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "hade",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "expire-stale-signals": {
            "task": "app.workers.signal_decay.expire_stale_signals",
            "schedule": 60.0,
        },
        "transition-event-statuses": {
            "task": "app.workers.event_lifecycle.transition_event_statuses",
            "schedule": 60.0,
        },
    },
)

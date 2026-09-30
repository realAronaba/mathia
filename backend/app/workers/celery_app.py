from celery import Celery

from app.core.config import settings

celery_app = Celery("mathia", broker=settings.redis_url, backend=settings.redis_url, include=["app.workers.tasks"])
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_time_limit=120,
    worker_prefetch_multiplier=1,
    timezone="Africa/Dakar",
    enable_utc=True,
)

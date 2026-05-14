"""
worker/celery_app.py — Celery application factory.

Rules:
- Redis is the broker AND result backend (ephemeral).
- Exam session state is NEVER stored only in Redis.
  Redis restart must not lose any exam data — all state lives in PostgreSQL.
- Soft time limits are set per-task type:
    Face inference tasks: 30 s soft / 60 s hard
    Grading tasks: 60 s soft / 120 s hard
    Email tasks: 20 s soft / 40 s hard
"""

from celery import Celery
from src.config import Config

celery_app = Celery(
    "examguard",
    broker=Config.REDIS_URL,
    backend=Config.REDIS_URL,
    include=[
        "src.worker.tasks.face_tasks",
        "src.worker.tasks.grading_tasks",
        "src.worker.tasks.email_tasks",
    ],
)

celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Retry / reliability
    task_acks_late=True,           # acknowledge AFTER task completes, not on receipt
    task_reject_on_worker_lost=True,
    # Results expire after 24 hours — we always read from PostgreSQL, not the result backend
    result_expires=86400,
    # Route face tasks to a dedicated queue so they don't block grading/email workers
    task_routes={
        "src.worker.tasks.face_tasks.*": {"queue": "face"},
        "src.worker.tasks.grading_tasks.*": {"queue": "grading"},
        "src.worker.tasks.email_tasks.*": {"queue": "default"},
    },
    # Per-task time limits are set in each task via @celery_app.task(soft_time_limit=...)
)

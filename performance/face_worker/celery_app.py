"""Celery application used only by the isolated face-worker benchmark."""

from __future__ import annotations

import os

from celery import Celery


BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/15")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", BROKER_URL)

celery_app = Celery(
    "examloc_face_benchmark",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=["performance.face_worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    result_expires=3600,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_routes={
        "performance.face_worker.tasks.verify_face_benchmark": {
            "queue": "face-benchmark"
        }
    },
)

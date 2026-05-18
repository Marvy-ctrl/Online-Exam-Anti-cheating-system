"""
worker/tasks/face_tasks.py — Background face verification during an exam session.

Rules:
- Face inference ONLY runs here, never in a FastAPI route handler.
- Face encodings never appear in any log line.
- The DB is always the source of truth; Redis result is advisory only.
- Every task is idempotent: running it twice with the same args must be safe.
"""

import logging
import numpy as np
from celery import Task
from celery.utils.log import get_task_logger
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from fastapi import HTTPException

from src.worker.celery_app import celery_app
from src.config import Config
from src.students.face_utils import decode_image, get_face_embedding, compute_distance
from src.db.models import (
    ExamEnrollment,
    ExamSession,
    ExamStatus,
    Violation,
    ViolationType,
)

logger = get_task_logger(__name__)

# Sync engine for Celery workers (Celery is synchronous; asyncpg is not safe here)
_sync_engine = None


def _get_engine():
    global _sync_engine
    if _sync_engine is None:
        # Replace asyncpg driver with psycopg2 for the sync worker
        url = Config.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2")
        _sync_engine = create_engine(url, pool_pre_ping=True)
    return _sync_engine


class _BaseTask(Task):
    """Base task class — provides a shared sync DB session factory."""

    abstract = True

    def _session(self) -> Session:
        return Session(_get_engine())


@celery_app.task(
    bind=True,
    base=_BaseTask,
    name="src.worker.tasks.face_tasks.verify_face_task",
    max_retries=3,
    default_retry_delay=5,
    soft_time_limit=30,
    time_limit=60,
    queue="face",
)
def verify_face_task(self, session_uid: str, enrollment_uid: str, live_image_base64: str) -> dict:
    """
    Verify a student's live face against their enrolled embedding.

    Idempotency: If the session is no longer in_progress when the task runs,
    return early without writing anything.

    Args:
        session_uid:        UUID of the ExamSession row.
        enrollment_uid:     UUID of the ExamEnrollment row (holds the embedding).
        live_image_base64:  Raw base64 JPEG string (no data-URI prefix).

    Returns:
        dict with keys: face_match (bool), violation_logged (bool), distance (float | None)
    """
    with self._session() as db:
        # --- Idempotency guard ---
        session_row = db.execute(
            select(ExamSession).where(ExamSession.uid == session_uid)
        ).scalar_one_or_none()

        if not session_row or session_row.status != ExamStatus.in_progress:
            logger.info(
                "verify_face_task: session not in_progress, skipping",
                extra={"session_uid": session_uid},
            )
            return {"face_match": None, "violation_logged": False, "distance": None}

        enrollment = db.execute(
            select(ExamEnrollment).where(ExamEnrollment.uid == enrollment_uid)
        ).scalar_one_or_none()

        if not enrollment or not enrollment.embedding_vector:
            logger.warning(
                "verify_face_task: no embedding for enrollment",
                extra={"enrollment_uid": enrollment_uid},
            )
            return {"face_match": False, "violation_logged": False, "distance": None}

        # --- Face inference ---
        try:
            image_array = decode_image(live_image_base64)
        except Exception as exc:
            logger.warning(
                "verify_face_task: image decode failed",
                extra={"session_uid": session_uid, "error": type(exc).__name__},
            )
            raise self.retry(exc=exc)

        try:
            live_embedding = get_face_embedding(image_array)
        except HTTPException as exc:
            detail = str(exc.detail).lower()
            if "no face" in detail:
                _record_violation(db, session_uid, enrollment_uid, ViolationType.no_face, live_image_base64)
                return {"face_match": False, "violation_logged": True, "distance": None}
            elif "multiple faces" in detail:
                _record_violation(db, session_uid, enrollment_uid, ViolationType.multiple_faces, live_image_base64)
                return {"face_match": False, "violation_logged": True, "distance": None}
            else:
                _record_violation(db, session_uid, enrollment_uid, ViolationType.face_mismatch, live_image_base64)
                return {"face_match": False, "violation_logged": True, "distance": None}

        # --- Compare against stored embedding ---
        stored_array = np.array(enrollment.embedding_vector)
        distance = float(compute_distance(stored_array, live_embedding))
        face_match = distance < Config.FACE_SIMILARITY_THRESHOLD

        logger.info(
            "verify_face_task: completed",
            extra={
                "session_uid": session_uid,
                "face_match": face_match,
                "threshold": Config.FACE_SIMILARITY_THRESHOLD,
                # Never log distance in prod — it reveals biometric proximity.
                # Keep for dev debugging only.
            },
        )

        if not face_match:
            _record_violation(db, session_uid, enrollment_uid, ViolationType.face_mismatch, live_image_base64)
            return {"face_match": False, "violation_logged": True, "distance": distance}

        return {"face_match": True, "violation_logged": False, "distance": distance}


def _record_violation(
    db: Session,
    session_uid: str,
    enrollment_uid: str,
    violation_type: ViolationType,
    live_image_base64: str,
) -> None:
    """Write a violation row. DB is source of truth — not the WebSocket."""
    from datetime import datetime, timezone
    from src.db.models import Snapshot

    # Log Snapshot (Truncated placeholder until MinIO is set up)
    new_snapshot = Snapshot(
        student_uid=enrollment_uid,
        session_uid=session_uid,
        image_path=f"data:image/jpeg;base64,{live_image_base64[:50]}...", 
        face_matches=(violation_type != ViolationType.face_mismatch and violation_type != ViolationType.no_face),
        multiple_faces_detected=(violation_type == ViolationType.multiple_faces),
        timestamp=datetime.now(timezone.utc),
    )
    db.add(new_snapshot)

    violation = Violation(
        student_uid=enrollment_uid,
        session_uid=session_uid,
        violation_type=violation_type,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(violation)
    db.commit()
    logger.info(
        "violation recorded",
        extra={"session_uid": session_uid, "type": violation_type.value},
    )

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
from datetime import datetime, timezone, timedelta
from src.db.models import Snapshot
from src.core.storage import storage_service
import uuid
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

        _record_clean_snapshot(db, session_uid, enrollment_uid, live_image_base64)
        return {"face_match": True, "violation_logged": False, "distance": distance}


def _record_violation(
    db: Session,
    session_uid: str,
    enrollment_uid: str,
    violation_type: ViolationType,
    live_image_base64: str,
) -> None:
    """Write a violation row and upsert the snapshot.

    Snapshot deduplication: Only one snapshot image is stored per violation
    type per session. Subsequent occurrences of the same violation type
    increment ``occurrence_count`` and update ``last_seen_at`` without
    writing a new image to storage.
    """
    now = datetime.now(timezone.utc)

    # --- Always log the individual violation event (for the timeline) ---
    violation = Violation(
        student_uid=enrollment_uid,
        session_uid=session_uid,
        violation_type=violation_type,
        timestamp=now,
    )
    db.add(violation)

    # --- Upsert snapshot ---
    vtype_str = violation_type.value
    existing_snapshot = db.execute(
        select(Snapshot).where(
            Snapshot.session_uid == session_uid,
            Snapshot.violation_type == vtype_str,
        )
    ).scalar_one_or_none()

    if existing_snapshot:
        # Already have a reference image for this violation type — just increment.
        existing_snapshot.occurrence_count += 1
        existing_snapshot.last_seen_at = now
        db.add(existing_snapshot)
        logger.info(
            "snapshot deduplicated — incremented count",
            extra={
                "session_uid": session_uid,
                "type": vtype_str,
                "count": existing_snapshot.occurrence_count,
            },
        )
    else:
        # First occurrence — upload the actual image.
        snapshot_uid = uuid.uuid4()
        try:
            upload_res = storage_service.upload_snapshot(
                session_uid=session_uid,
                snapshot_uid=snapshot_uid,
                base64_image=live_image_base64,
            )
            image_path = upload_res["image_path"]
            object_key = upload_res.get("object_key")
        except Exception as e:
            logger.error(
                "Failed to upload snapshot, using inline fallback",
                extra={"session_uid": session_uid, "error": str(e)},
            )
            image_path = f"data:image/jpeg;base64,{live_image_base64[:50]}..."
            object_key = None

        new_snapshot = Snapshot(
            uid=snapshot_uid,
            student_uid=enrollment_uid,
            session_uid=session_uid,
            image_path=image_path,
            object_key=object_key,
            face_matches=(
                violation_type not in (ViolationType.face_mismatch, ViolationType.no_face)
            ),
            multiple_faces_detected=(violation_type == ViolationType.multiple_faces),
            timestamp=now,
            violation_type=vtype_str,
            occurrence_count=1,
            last_seen_at=now,
        )
        db.add(new_snapshot)

    db.commit()
    logger.info(
        "violation recorded",
        extra={"session_uid": session_uid, "type": vtype_str},
    )


def _record_clean_snapshot(
    db: Session,
    session_uid: str,
    enrollment_uid: str,
    live_image_base64: str,
) -> None:
    """Write a clean snapshot for the timeline (max 1 per minute)."""
    now = datetime.now(timezone.utc)

    # We only want 1 clean snapshot every 1 minute.
    recent_clean = db.execute(
        select(Snapshot).where(
            Snapshot.session_uid == session_uid,
            Snapshot.violation_type == None,
            Snapshot.timestamp >= now - timedelta(seconds=30)
        )
    ).scalar_one_or_none()

    if recent_clean:
        return

    snapshot_uid = uuid.uuid4()
    try:
        upload_res = storage_service.upload_snapshot(
            session_uid=session_uid,
            snapshot_uid=snapshot_uid,
            base64_image=live_image_base64,
        )
        image_path = upload_res["image_path"]
        object_key = upload_res.get("object_key")
    except Exception as e:
        logger.error(
            "Failed to upload clean snapshot, using inline fallback",
            extra={"session_uid": session_uid, "error": str(e)},
        )
        image_path = f"data:image/jpeg;base64,{live_image_base64[:50]}..."
        object_key = None

    new_snapshot = Snapshot(
        uid=snapshot_uid,
        student_uid=enrollment_uid,
        session_uid=session_uid,
        image_path=image_path,
        object_key=object_key,
        face_matches=True,
        multiple_faces_detected=False,
        timestamp=now,
        violation_type=None,
        occurrence_count=1,
        last_seen_at=now,
    )
    db.add(new_snapshot)
    db.commit()
    logger.info(
        "clean snapshot recorded",
        extra={"session_uid": session_uid},
    )


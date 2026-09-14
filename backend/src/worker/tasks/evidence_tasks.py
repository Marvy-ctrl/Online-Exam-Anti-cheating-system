"""Periodic privacy cleanup for retained webcam violation evidence."""

from datetime import datetime, timedelta, timezone

from celery.utils.log import get_task_logger
from sqlalchemy import or_, select

from src.config import Config
from src.core.storage import storage_service
from src.db.models import Snapshot
from src.worker.celery_app import celery_app
from src.worker.tasks.face_tasks import _BaseTask


logger = get_task_logger(__name__)
EVIDENCE_CLEANUP_BATCH_SIZE = 500


def purge_snapshot_evidence(db, now: datetime) -> dict[str, int]:
    """Delete legacy clean/inline frames and evidence past retention."""
    cutoff = now - timedelta(days=Config.SNAPSHOT_RETENTION_DAYS)
    snapshots = db.execute(
        select(Snapshot)
        .where(
            or_(
                Snapshot.violation_type.is_(None),
                Snapshot.image_path.like("data:image/%"),
                Snapshot.timestamp <= cutoff,
            )
        )
        .with_for_update(skip_locked=True)
        .limit(EVIDENCE_CLEANUP_BATCH_SIZE)
    ).scalars().all()

    deleted = 0
    retryable = 0
    for snapshot in snapshots:
        storage_deleted = storage_service.delete_snapshot(
            session_uid=str(snapshot.session_uid),
            snapshot_uid=snapshot.uid,
            object_key=snapshot.object_key,
            image_path=snapshot.image_path,
        )
        if not storage_deleted:
            retryable += 1
            continue

        db.delete(snapshot)
        deleted += 1

    if deleted:
        db.commit()

    return {"deleted": deleted, "retryable": retryable}


@celery_app.task(
    bind=True,
    base=_BaseTask,
    name="src.worker.tasks.evidence_tasks.purge_snapshot_evidence_task",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
    soft_time_limit=60,
    time_limit=120,
    queue="grading",
)
def purge_snapshot_evidence_task(self) -> dict[str, int]:
    with self._session() as db:
        result = purge_snapshot_evidence(db, datetime.now(timezone.utc))

    logger.info("Snapshot evidence cleanup finished", extra=result)
    return result

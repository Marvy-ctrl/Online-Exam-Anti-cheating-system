"""Periodic recovery for expired and submitted-but-ungraded exam sessions."""

from datetime import datetime, timezone

from celery.utils.log import get_task_logger
from sqlalchemy import select

from src.db.models import ExamSession, ExamStatus
from src.worker.celery_app import celery_app
from src.worker.tasks.face_tasks import _BaseTask
from src.worker.tasks.grading_tasks import grade_and_notify_task


logger = get_task_logger(__name__)
FINALIZATION_BATCH_SIZE = 500


def finalize_expired_sessions(db, now: datetime) -> list[str]:
    """Atomically mark one batch of overdue sessions as submitted."""
    expired_sessions = db.execute(
        select(ExamSession)
        .where(
            ExamSession.status == ExamStatus.in_progress,
            ExamSession.expected_end_time.is_not(None),
            ExamSession.expected_end_time <= now,
        )
        .with_for_update(skip_locked=True)
        .limit(FINALIZATION_BATCH_SIZE)
    ).scalars().all()

    finalized_ids = []
    for exam_session in expired_sessions:
        # Preserve the authoritative deadline instead of recording a delayed
        # worker's wall-clock time as the student's completion time.
        exam_session.end_time = exam_session.expected_end_time
        exam_session.status = ExamStatus.submitted
        db.add(exam_session)
        finalized_ids.append(str(exam_session.uid))

    if finalized_ids:
        db.commit()

    return finalized_ids


def find_ungraded_submissions(db) -> list[str]:
    """Find submitted sessions whose grading dispatch was lost or delayed."""
    session_ids = db.execute(
        select(ExamSession.uid)
        .where(
            ExamSession.status == ExamStatus.submitted,
            ExamSession.score.is_(None),
        )
        .limit(FINALIZATION_BATCH_SIZE)
    ).scalars().all()
    return [str(session_uid) for session_uid in session_ids]


@celery_app.task(
    bind=True,
    base=_BaseTask,
    name="src.worker.tasks.completion_tasks.finalize_expired_sessions_task",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
    soft_time_limit=30,
    time_limit=60,
    queue="grading",
)
def finalize_expired_sessions_task(self) -> dict:
    """Finalize overdue sessions and recover any missing grading dispatches."""
    with self._session() as db:
        finalized_ids = finalize_expired_sessions(db, datetime.now(timezone.utc))
        grading_ids = find_ungraded_submissions(db)

    # Dispatch only after the finalization transaction has committed.
    for session_uid in grading_ids:
        grade_and_notify_task.delay(session_uid)

    logger.info(
        "Exam completion reconciliation finished",
        extra={
            "finalized_count": len(finalized_ids),
            "grading_queued_count": len(grading_ids),
        },
    )
    return {
        "finalized": len(finalized_ids),
        "grading_queued": len(grading_ids),
    }

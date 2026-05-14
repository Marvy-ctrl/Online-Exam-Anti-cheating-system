"""
worker/tasks/email_tasks.py — Background email dispatch.

Rules:
- Emails are always sent asynchronously.
- Idempotency: if an email fails, it will retry. We do not currently track
  "email_sent_at" on the session, but we assume the SMTP provider handles duplicate
  suppression if the exact same payload is sent too quickly. 
"""

import logging
from celery.utils.log import get_task_logger
from sqlalchemy import select

from src.worker.celery_app import celery_app
from src.worker.tasks.face_tasks import _BaseTask
from src.db.models import (
    ExamSession,
    Exam,
    ExamEnrollment,
)
from src.auth.email import send_exam_result_email

logger = get_task_logger(__name__)


@celery_app.task(
    bind=True,
    base=_BaseTask,
    name="src.worker.tasks.email_tasks.send_result_email_task",
    max_retries=3,
    default_retry_delay=10,
    soft_time_limit=20,
    time_limit=40,
    queue="default",
)
def send_result_email_task(self, session_uid: str) -> dict:
    """
    Send the exam result email to the student.
    """
    with self._session() as db:
        # Join session -> enrollment and exam
        stmt = select(ExamSession, Exam, ExamEnrollment).join(
            Exam, ExamSession.exam_uid == Exam.uid
        ).join(
            ExamEnrollment, ExamSession.student_uid == ExamEnrollment.uid
        ).where(ExamSession.uid == session_uid)
        
        row = db.execute(stmt).first()
        
        if not row:
            logger.error(f"send_result_email_task: session {session_uid} not found")
            return {"error": "Session not found"}
            
        exam_session, exam, enrollment = row
        
        if exam_session.score is None:
            logger.warning(f"send_result_email_task: session {session_uid} not yet graded. Retrying.")
            raise self.retry(countdown=5)

        student_name = f"{enrollment.first_name} {enrollment.last_name}"
        
        try:
            # Note: send_exam_result_email currently takes a list of emails
            send_exam_result_email(
                emails=[enrollment.email],
                student_name=student_name,
                exam_title=exam.title,
                score=exam_session.score,
                percentage=exam_session.score_percentage
            )
            logger.info(
                "send_result_email_task: email sent successfully",
                extra={"session_uid": session_uid, "email": enrollment.email}
            )
            return {"status": "sent", "email": enrollment.email}
        except Exception as exc:
            logger.error(
                "send_result_email_task: failed to send email",
                extra={"session_uid": session_uid, "error": str(exc)}
            )
            raise self.retry(exc=exc)

"""
worker/tasks/grading_tasks.py — Background exam autograding.

Rules:
- Autograding is CPU-intensive for large exams, so it runs in a Celery worker.
- Must be idempotent: if an exam is already graded, it should gracefully return.
"""

from celery.utils.log import get_task_logger
from sqlalchemy import select

from src.worker.celery_app import celery_app
from src.worker.tasks.face_tasks import _BaseTask
from src.db.models import (
    ExamSession,
    Question,
    Options,
    StudentAnswers,
    ExamStatus,
)

logger = get_task_logger(__name__)


@celery_app.task(
    bind=True,
    base=_BaseTask,
    name="src.worker.tasks.grading_tasks.grade_and_notify_task",
    max_retries=3,
    default_retry_delay=10,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    soft_time_limit=60,
    time_limit=120,
    queue="grading",
)
def grade_and_notify_task(self, session_uid: str) -> dict:
    """
    Autograde a submitted exam session.
    
    Idempotency:
    - If a submitted session is already scored, skip grading.
    """
    with self._session() as db:
        exam_session = db.execute(
            select(ExamSession)
            .where(ExamSession.uid == session_uid)
            .with_for_update()
        ).scalar_one_or_none()

        if not exam_session:
            logger.error(f"grade_and_notify_task: session {session_uid} not found")
            return {"error": "Session not found"}

        if exam_session.status != ExamStatus.submitted:
            logger.warning(
                "grade_and_notify_task: session is not submitted",
                extra={"session_uid": session_uid},
            )
            return {"error": "Session is not submitted"}

        if exam_session.score is not None:
            logger.info(
                "grade_and_notify_task: session already graded",
                extra={"session_uid": session_uid},
            )
            return {
                "status": "already_graded",
                "score": exam_session.score,
                "percentage": exam_session.score_percentage,
            }

        # Perform Autograding
        # 1. Fetch all questions for this exam
        questions = db.execute(
            select(Question).where(Question.exam_uid == exam_session.exam_uid)
        ).scalars().all()
        
        total_questions = len(questions)

        if total_questions == 0:
            exam_session.score = 0
            exam_session.score_percentage = 0
        else:
            # 2. Fetch all student answers for this session
            student_answers_rows = db.execute(
                select(StudentAnswers).where(StudentAnswers.session_uid == exam_session.uid)
            ).scalars().all()
            
            student_answers_map = {
                str(answer.question_uid): answer
                for answer in student_answers_rows
            }

            earned_marks = 0
            total_possible_marks = sum(q.marks for q in questions)

            # 3. For each question, find correct options and compare
            for q in questions:
                correct_options = db.execute(
                    select(Options).where(Options.question_uid == q.uid, Options.is_correct == True)
                ).scalars().all()
                
                correct_option_uids = [str(o.uid) for o in correct_options]
                answer = student_answers_map.get(str(q.uid))
                student_selected = answer.selected_option_uids if answer else []
                is_correct = (
                    bool(correct_option_uids)
                    and set(student_selected) == set(correct_option_uids)
                )

                if answer:
                    answer.is_correct = is_correct
                    db.add(answer)

                # Simple exact match check
                if is_correct:
                    earned_marks += q.marks

            exam_session.score = float(earned_marks)
            if total_possible_marks > 0:
                exam_session.score_percentage = (earned_marks / total_possible_marks) * 100
            else:
                exam_session.score_percentage = 0

        db.add(exam_session)
        db.commit()

        logger.info(
            "grade_and_notify_task: graded successfully",
            extra={
                "session_uid": session_uid,
                "score": exam_session.score,
                "percentage": exam_session.score_percentage
            }
        )

        # Enqueue the email task (DISABLED: Email is now explicitly sent by examiner to allow review and bulk releasing)
        # from src.worker.tasks.email_tasks import send_result_email_task
        # send_result_email_task.delay(session_uid)

        return {
            "status": "graded",
            "score": exam_session.score,
            "percentage": exam_session.score_percentage
        }

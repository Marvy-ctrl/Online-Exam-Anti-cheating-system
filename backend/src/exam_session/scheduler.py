from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timezone
from sqlmodel import select
from src.db.models import ExamSession, ExamStatus
from src.db.main import get_session

scheduler = AsyncIOScheduler()


async def auto_submit_expired_exams():
    """Auto-submit exams that have passed their expected_end_time"""
    async for session in get_session():
        # Find all in-progress sessions that have passed expected_end_time
        statement = select(ExamSession).where(
            ExamSession.status == ExamStatus.in_progress,
            ExamSession.expected_end_time <= datetime.now(timezone.utc),
        )
        result = await session.exec(statement)
        expired_sessions = result.all()

        for exam_session in expired_sessions:
            exam_session.end_time = exam_session.expected_end_time
            exam_session.status = ExamStatus.submitted
            session.add(exam_session)

        await session.commit()


def start_scheduler():
    # Run every minute to check for expired exams
    scheduler.add_job(auto_submit_expired_exams, "interval", minutes=1)
    scheduler.start()

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func, desc, cast, Date
from src.db.models import Institution, Exam, Student, ExamSession, Violation, ExamEnrollment
from datetime import datetime, timezone, timedelta
from uuid import UUID

class AnalyticsService:
    async def get_analytics_dashboard(self, session: AsyncSession, admin_uid: str):
        # 1. Overview stats
        total_inst_stmt = select(func.count(Institution.uid)).where(Institution.admin_uid == admin_uid)
        total_exams_stmt = select(func.count(Exam.uid)).where(Exam.admin_uid == admin_uid)
        total_students_stmt = select(func.count(Student.uid)).join(Institution).where(Institution.admin_uid == admin_uid)
        total_violations_stmt = select(func.count(Violation.uid)).join(ExamSession).join(Exam).where(Exam.admin_uid == admin_uid)

        overview = {
            "total_institutions": (await session.exec(total_inst_stmt)).one(),
            "total_exams": (await session.exec(total_exams_stmt)).one(),
            "total_students": (await session.exec(total_students_stmt)).one(),
            "total_violations": (await session.exec(total_violations_stmt)).one(),
        }

        # 2. Violation Distribution
        violation_dist_stmt = (
            select(Violation.violation_type, func.count(Violation.uid).label("count"))
            .join(ExamSession)
            .join(Exam)
            .where(Exam.admin_uid == admin_uid)
            .group_by(Violation.violation_type)
        )
        violation_dist_results = await session.exec(violation_dist_stmt)
        violation_distribution = [
            {"violation_type": row[0], "count": row[1]} for row in violation_dist_results.all()
        ]

        # 3. Violation Trend (Last 30 days)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        violation_trend_stmt = (
            select(cast(Violation.timestamp, Date).label("date"), func.count(Violation.uid).label("count"))
            .join(ExamSession)
            .join(Exam)
            .where(Exam.admin_uid == admin_uid, Violation.timestamp >= thirty_days_ago)
            .group_by(cast(Violation.timestamp, Date))
            .order_by(cast(Violation.timestamp, Date))
        )
        violation_trend_results = await session.exec(violation_trend_stmt)
        violation_trend = [
            {"date": row[0], "count": row[1]} for row in violation_trend_results.all()
        ]

        # 4. Session Trend (Last 30 days)
        session_trend_stmt = (
            select(cast(ExamSession.start_time, Date).label("date"), func.count(ExamSession.uid).label("count"))
            .join(Exam)
            .where(Exam.admin_uid == admin_uid, ExamSession.start_time >= thirty_days_ago)
            .group_by(cast(ExamSession.start_time, Date))
            .order_by(cast(ExamSession.start_time, Date))
        )
        session_trend_results = await session.exec(session_trend_stmt)
        session_trend = [
            {"date": row[0], "count": row[1]} for row in session_trend_results.all()
        ]

        # 5. Top Violators (Students)
        top_violators_stmt = (
            select(
                (ExamEnrollment.first_name + " " + ExamEnrollment.last_name).label("name"),
                func.count(Violation.uid).label("violation_count")
            )
            .join(Violation, Violation.student_uid == ExamEnrollment.uid)
            .join(ExamSession, Violation.session_uid == ExamSession.uid)
            .join(Exam, ExamSession.exam_uid == Exam.uid)
            .where(Exam.admin_uid == admin_uid)
            .group_by(ExamEnrollment.uid, ExamEnrollment.first_name, ExamEnrollment.last_name)
            .order_by(desc("violation_count"))
            .limit(5)
        )
        top_violators_results = await session.exec(top_violators_stmt)
        top_violators = [
            {"name": row[0], "violation_count": row[1]} for row in top_violators_results.all()
        ]

        return {
            "overview": overview,
            "violation_distribution": violation_distribution,
            "violation_trend": violation_trend,
            "session_trend": session_trend,
            "top_violators": top_violators,
        }

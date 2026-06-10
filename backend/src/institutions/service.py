from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, desc, func
from src.db.models import Institution, Exam, Student, ExamSession, Violation, ExamEnrollment
from datetime import datetime, timezone
from uuid import UUID
from .schema import InstitutionCreateModel

class InstitutionService:
    async def create_institution(
        self, institution_data: InstitutionCreateModel, admin_uid: str, session: AsyncSession
    ):
        institution_dict = institution_data.model_dump()
        institution_dict["admin_uid"] = UUID(admin_uid)
        
        new_institution = Institution(**institution_dict)
        session.add(new_institution)
        await session.commit()
        await session.refresh(new_institution)
        return new_institution

    async def get_all_institutions(self, session: AsyncSession, admin_uid: str):
        # Fetch only institutions owned by the logged-in admin
        statement = select(Institution).where(Institution.admin_uid == admin_uid).order_by(desc(Institution.created_at))
        result = await session.exec(statement)
        return result.all()
        
    async def get_institution(self, institution_uid: str, session: AsyncSession, admin_uid: str):
        # Enforce multi-tenant safety by ensuring it is owned by the admin
        statement = select(Institution).where(
            Institution.uid == institution_uid, 
            Institution.admin_uid == admin_uid
        )
        result = await session.exec(statement)
        return result.first()

    async def delete_institution(self, institution_uid: str, session: AsyncSession, admin_uid: str) -> bool:
        """Deletes an institution if it exists and is owned by the admin."""
        institution = await self.get_institution(institution_uid, session, admin_uid)
        if not institution:
            return False
        
        await session.delete(institution)
        await session.commit()
        return True

    async def get_dashboard_overview(self, session: AsyncSession, admin_uid: str):
        # 1. Institutions count
        inst_stmt = select(func.count(Institution.uid)).where(Institution.admin_uid == admin_uid)
        institutions_count = (await session.exec(inst_stmt)).one()

        # 2. Active Exams count
        now = datetime.now(timezone.utc)
        exams_stmt = select(func.count(Exam.uid)).where(
            Exam.admin_uid == admin_uid,
            Exam.start_time <= now,
            Exam.end_time >= now
        )
        active_exams_count = (await session.exec(exams_stmt)).one()

        # 3. Total Students count
        students_stmt = (
            select(func.count(Student.uid))
            .join(Institution)
            .where(Institution.admin_uid == admin_uid)
        )
        total_students_count = (await session.exec(students_stmt)).one()

        # 4. Violations Detected count
        violations_stmt = (
            select(func.count(Violation.uid))
            .join(ExamSession)
            .join(Exam)
            .where(Exam.admin_uid == admin_uid)
        )
        violations_detected_count = (await session.exec(violations_stmt)).one()

        # 5. Recent Violations (up to 5)
        recent_violations_stmt = (
            select(Violation, ExamEnrollment.first_name, ExamEnrollment.last_name, Exam.title)
            .join(ExamSession, Violation.session_uid == ExamSession.uid)
            .join(Exam, ExamSession.exam_uid == Exam.uid)
            .join(ExamEnrollment, Violation.student_uid == ExamEnrollment.uid)
            .where(Exam.admin_uid == admin_uid)
            .order_by(desc(Violation.timestamp))
            .limit(5)
        )
        recent_violations = (await session.exec(recent_violations_stmt)).all()

        # 6. Recent Submissions / Session Starts (up to 5)
        recent_sessions_stmt = (
            select(ExamSession, ExamEnrollment.first_name, ExamEnrollment.last_name, Exam.title)
            .join(Exam, ExamSession.exam_uid == Exam.uid)
            .join(ExamEnrollment, ExamSession.student_uid == ExamEnrollment.uid)
            .where(Exam.admin_uid == admin_uid)
            .order_by(desc(ExamSession.start_time))
            .limit(5)
        )
        recent_sessions = (await session.exec(recent_sessions_stmt)).all()

        # 7. Recent Institutions created (up to 5)
        recent_inst_stmt = (
            select(Institution)
            .where(Institution.admin_uid == admin_uid)
            .order_by(desc(Institution.created_at))
            .limit(5)
        )
        recent_insts = (await session.exec(recent_inst_stmt)).all()

        # Combine them
        activities = []
        for v, first_name, last_name, exam_title in recent_violations:
            activities.append({
                "type": "violation",
                "title": "Violation Detected",
                "description": f"{first_name} {last_name} - {v.violation_type.replace('_', ' ').title()} during '{exam_title}'",
                "timestamp": v.timestamp.isoformat()
            })
        for s, first_name, last_name, exam_title in recent_sessions:
            event_type = "submission" if s.status == "Submitted" else "session_start"
            title = "Exam Submitted" if s.status == "Submitted" else "Exam Started"
            description = (
                f"{first_name} {last_name} submitted '{exam_title}'"
                if s.status == "Submitted"
                else f"{first_name} {last_name} started '{exam_title}'"
            )
            timestamp = s.end_time if s.status == "Submitted" and s.end_time else s.start_time
            activities.append({
                "type": event_type,
                "title": title,
                "description": description,
                "timestamp": timestamp.isoformat()
            })
        for inst in recent_insts:
            activities.append({
                "type": "institution",
                "title": "New Institution",
                "description": f"Created institution '{inst.name}'",
                "timestamp": inst.created_at.isoformat()
            })

        # Sort combined list by timestamp desc and take top 5
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        recent_activities = activities[:5]

        return {
            "institutions_count": institutions_count,
            "active_exams_count": active_exams_count,
            "total_students_count": total_students_count,
            "violations_detected_count": violations_detected_count,
            "recent_activities": recent_activities,
        }

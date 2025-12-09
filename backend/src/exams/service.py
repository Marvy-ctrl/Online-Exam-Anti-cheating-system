from .schema import (
    SubjectCreateModel,
    SubjectResponseModel,
    ExamCreateModel,
    ExamUpdateModel,
    StudentPreEnrollModel,
)
from src.db.main import get_session
from src.db.models import Subject, Exam, ExamEnrollment
from sqlmodel.ext.asyncio.session import AsyncSession
from uuid import UUID
from sqlmodel import select, desc
from datetime import timezone, datetime
import uuid


class ExamService:
    async def create_subject(
        self, subject_name: SubjectCreateModel, session: AsyncSession
    ):
        subject_dict = subject_name.model_dump()
        new_subject = Subject(**subject_dict)
        session.add(new_subject)
        await session.commit()
        return new_subject

    async def get_exam_by_uid(self, uid: str, session: AsyncSession):
        statement = select(Exam).where(Exam.uid == uid)
        result = await session.exec(statement)
        return result.first()

    async def pre_enroll_students(
        self,
        student_details: StudentPreEnrollModel,
        exam_uid: str,
        session: AsyncSession,
    ):
        exam = await self.get_exam_by_uid(exam_uid, session)
        if not exam:
            return None
        statement = select(ExamEnrollment).where(
            ExamEnrollment.exam_uid == exam_uid,
            ExamEnrollment.student_id == student_details.student_id,
        )
        result = await session.exec(statement)
        existing = result.first()
        if existing:
            return existing

        new_student = ExamEnrollment(
            uid=uuid.uuid4(),
            exam_uid=exam_uid,
            first_name=student_details.first_name,
            last_name=student_details.last_name,
            email=student_details.email,
            student_id=student_details.student_id,
            status="pending",
            embedding_vector=None,
            photo_url=None,
            enrolled_at=None,
        )

        session.add(new_student)
        await session.commit()
        await session.refresh(new_student)

        return new_student

    async def create_exam(
        self, exam: ExamCreateModel, admin_uid: str, session: AsyncSession
    ):
        exam_dict = exam.model_dump()
        exam_dict["admin_uid"] = UUID(admin_uid)

        new_exam = Exam(**exam_dict)
        session.add(new_exam)
        await session.commit()
        await session.refresh(new_exam)
        return new_exam

    async def get_all_exams(self, session: AsyncSession):
        statement = select(Exam).order_by(desc(Exam.created_at))
        result = await session.exec(statement)
        return result.all()

    async def get_an_exam(self, exam_uid: str, session: AsyncSession):
        statement = select(Exam).where(Exam.uid == exam_uid)
        result = await session.exec(statement)
        return result.first()

    async def update_exam(
        self,
        exam_uid: str,
        update_data: ExamUpdateModel,
        session: AsyncSession,
        admin_uid: str,
    ):
        exam_to_update = await self.get_an_exam(exam_uid, session)
        if exam_to_update is not None:
            update_data_dict = update_data.model_dump()
            for key, value in update_data_dict.items():
                setattr(exam_to_update, key, value)
                exam_to_update.updated_at = datetime.now(timezone.utc).replace(
                    tzinfo=None
                )
                await session.commit()
            return exam_to_update
        else:
            return None

    async def delete_exam(self, exam_uid: str, session: AsyncSession):
        exam_to_delete = await self.get_an_exam(exam_uid, session)
        if exam_to_delete is not None:
            await session.delete(exam_to_delete)
            await session.commit()
            return {"message": "Exam deleted successfully"}
        else:
            return None

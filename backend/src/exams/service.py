from .schema import (
    SubjectCreateModel,
    ExamCreateModel,
    ExamUpdateModel,
    StudentPreEnrollModel,
    SubjectUpdateModel,
    BulkPreEnrollModel,
    StudentUpdateModel
)
from src.db.models import (
    Subject,
    Exam,
    ExamEnrollment,
    ExamEnrollmentStatus,
    Student, SubjectEnrollment
)

from sqlmodel.ext.asyncio.session import AsyncSession
from uuid import UUID
from sqlmodel import select, desc, and_
from datetime import timezone, datetime
import uuid


class ExamService:

    async def create_subject(
        self, subject_name: SubjectCreateModel, admin_uid: str, session: AsyncSession
    ):
        subject_dict = subject_name.model_dump()
        new_subject = Subject(**subject_dict)
        session.add(new_subject)
        await session.commit()
        return new_subject

    async def get_subject_owned_by(self, subject_uid: str, admin_uid: str, session: AsyncSession):
        from src.db.models import Institution
        statement = (
            select(Subject)
            .join(Institution)
            .where(
                and_(
                    Subject.uid == subject_uid,
                    Institution.admin_uid == admin_uid
                )
            )
        )
        result = await session.exec(statement)
        return result.first()

    async def update_subject(self, subject_uid: str, update_data: SubjectUpdateModel, session: AsyncSession, admin_uid: str):
        subject_to_update = await self.get_subject_owned_by(subject_uid, admin_uid, session)
        if subject_to_update is None:
            return None
        
        update_data_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_data_dict.items():
            setattr(subject_to_update, key, value)
            
        subject_to_update.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(subject_to_update)
        return subject_to_update

    async def delete_subject(self, subject_uid: str, admin_uid: str, session: AsyncSession):
        subject_to_delete = await self.get_subject_owned_by(subject_uid, admin_uid, session)
        if subject_to_delete is None:
            return None
        await session.delete(subject_to_delete)
        await session.commit()
        return {"message": "Subject deleted successfully"}

    async def get_all_subjects(self, session: AsyncSession, admin_uid: str, institution_uid: str = None):
        from src.db.models import Institution
        statement = select(Subject).join(Institution).where(Institution.admin_uid == admin_uid)
        if institution_uid:
            statement = statement.where(Subject.institution_uid == institution_uid)
        statement = statement.order_by(Subject.name)
        result = await session.exec(statement)
        return result.all()

    async def get_an_exam(self, exam_uid: str, session: AsyncSession):
        """Fetch a single exam by UID regardless of owner. Used for read-only lookups."""
        statement = select(Exam).where(Exam.uid == exam_uid)
        result = await session.exec(statement)
        return result.first()

    async def get_exam_with_subject(self, exam_uid: str, session: AsyncSession):
        """Fetch a single exam and eagerly load its subject name for the frontend detail view."""
        from src.db.models import Exam, Subject
        statement = select(Exam, Subject).join(Subject, Exam.subject_uid == Subject.uid, isouter=True).where(Exam.uid == exam_uid)
        result = (await session.exec(statement)).first()
        if result:
            exam, subject = result
            exam_dict = exam.model_dump()
            exam_dict["subject_name"] = subject.name if subject else None
            return exam_dict
        return None

    async def get_exam_owned_by(
        self, exam_uid: str, admin_uid: str, session: AsyncSession
    ):
        """
        Fetch an exam only if it belongs to the requesting examiner.
        Use this for any mutating operation (update, delete, enroll link generation)
        to enforce tenant ownership — prevents cross-examiner exam tampering.
        """
        statement = select(Exam).where(
            and_(Exam.uid == exam_uid, Exam.admin_uid == admin_uid)
        )
        result = await session.exec(statement)
        return result.first()

    async def pre_enroll_students(
        self,
        student_details: StudentPreEnrollModel,
        exam_uid: str,
        session: AsyncSession,
    ):
        exam = await self.get_an_exam(exam_uid, session)
        if not exam:
            return None

        # 1. Sync Master Student Record
        statement = select(Student).where(
            and_(
                Student.student_id == student_details.student_id,
                Student.institution_uid == exam.institution_uid
            )
        )
        student_record = (await session.exec(statement)).first()
        if not student_record:
            student_record = Student(
                institution_uid=exam.institution_uid,
                first_name=student_details.first_name,
                last_name=student_details.last_name,
                email=student_details.email,
                student_id=student_details.student_id,
            )
            session.add(student_record)
            await session.commit()
            await session.refresh(student_record)

        # 2. Sync Subject Enrollment (if exam belongs to a subject)
        if exam.subject_uid:
            subj_stmt = select(SubjectEnrollment).where(
                and_(
                    SubjectEnrollment.student_uid == student_record.uid,
                    SubjectEnrollment.subject_uid == exam.subject_uid
                )
            )
            subj_enrollment = (await session.exec(subj_stmt)).first()
            if not subj_enrollment:
                subj_enrollment = SubjectEnrollment(
                    student_uid=student_record.uid,
                    subject_uid=exam.subject_uid
                )
                session.add(subj_enrollment)

        # 3. Prevent duplicate Exam Enrollment
        statement = select(ExamEnrollment).where(
            and_(
                ExamEnrollment.exam_uid == exam_uid,
                ExamEnrollment.student_id == student_details.student_id,
            )
        )
        existing = (await session.exec(statement)).first()
        if existing:
            # Optionally update student_uid if it was missing previously
            if not existing.student_uid:
                existing.student_uid = student_record.uid
                session.add(existing)
                await session.commit()
            return existing

        # 4. Create Exam Enrollment
        new_student = ExamEnrollment(
            uid=uuid.uuid4(),
            exam_uid=exam_uid,
            student_uid=student_record.uid,
            first_name=student_details.first_name,
            last_name=student_details.last_name,
            email=student_details.email,
            student_id=student_details.student_id,
            status=ExamEnrollmentStatus.pending,
            embedding_vector=None,
            face_s3_url=None,
        )

        session.add(new_student)
        await session.commit()
        await session.refresh(new_student)

        return new_student

    async def bulk_pre_enroll_students(
        self,
        bulk_data: BulkPreEnrollModel,
        exam_uid: str,
        session: AsyncSession,
    ):
        results = []
        for student_info in bulk_data.students:
            enrolled = await self.pre_enroll_students(student_info, exam_uid, session)
            if enrolled:
                results.append(enrolled)
        return results

    async def create_exam(
        self, exam: ExamCreateModel, admin_uid: str, session: AsyncSession
    ):
        exam_dict = exam.model_dump()
        # admin_uid is always set from the authenticated token, never from client input.
        exam_dict["admin_uid"] = UUID(admin_uid)

        new_exam = Exam(**exam_dict)
        session.add(new_exam)
        await session.commit()
        await session.refresh(new_exam)
        return new_exam

    async def get_all_exams(self, session: AsyncSession, admin_uid: str, institution_uid: str = None, subject_uid: str = None):
        """Return exams belonging to the requesting examiner, optionally filtered by institution_uid or subject_uid."""
        statement = select(Exam).where(Exam.admin_uid == admin_uid)
        
        if institution_uid:
            statement = statement.where(Exam.institution_uid == institution_uid)
        if subject_uid:
            statement = statement.where(Exam.subject_uid == subject_uid)
            
        statement = statement.order_by(desc(Exam.created_at))
        
        result = await session.exec(statement)
        return result.all()

    async def update_exam(
        self,
        exam_uid: str,
        update_data: ExamUpdateModel,
        session: AsyncSession,
        admin_uid: str,
    ):
        # Ownership check — an examiner can only update their own exams.
        exam_to_update = await self.get_exam_owned_by(exam_uid, admin_uid, session)
        if exam_to_update is None:
            return None

        update_data_dict = update_data.model_dump()
        for key, value in update_data_dict.items():
            setattr(exam_to_update, key, value)

        # Single commit after all fields are set — prevents partial writes.
        exam_to_update.updated_at = datetime.now(timezone.utc)
        await session.commit()
        return exam_to_update

    async def delete_exam(
        self, exam_uid: str, admin_uid: str, session: AsyncSession
    ):
        # Ownership check — an examiner can only delete their own exams.
        exam_to_delete = await self.get_exam_owned_by(exam_uid, admin_uid, session)
        if exam_to_delete is None:
            return None

        await session.delete(exam_to_delete)
        await session.commit()
        return {"message": "Exam deleted successfully"}

    async def get_students_for_institution(self, session: AsyncSession, institution_uid: str, admin_uid: str):
        from src.db.models import Student, Institution
        # Verify the admin owns the institution
        verify_stmt = select(Institution).where(and_(Institution.uid == institution_uid, Institution.admin_uid == admin_uid))
        inst = (await session.exec(verify_stmt)).first()
        if not inst:
            return None
        
        statement = select(Student).where(Student.institution_uid == institution_uid).order_by(desc(Student.created_at))
        result = await session.exec(statement)
        return result.all()

    async def get_students_for_exam(self, session: AsyncSession, exam_uid: str, admin_uid: str):
        from src.db.models import Exam, ExamEnrollment
        # Verify the admin owns the exam
        verify_stmt = select(Exam).where(and_(Exam.uid == exam_uid, Exam.admin_uid == admin_uid))
        exam = (await session.exec(verify_stmt)).first()
        if not exam:
            return None
        
        # Fetch the Exact ExamEnrollment records for this exam
        statement = select(ExamEnrollment).where(ExamEnrollment.exam_uid == exam_uid).order_by(desc(ExamEnrollment.created_at))
        result = await session.exec(statement)
        
        enrollments = []
        for enrollment in result.all():
            enroll_dict = enrollment.model_dump()
            # We map ExamEnrollment's uid to be the one we use for frontend operations (remove/edit)
            # but wait, the frontend currently expects the `uid` to be the master student's uid.
            # To fix the bugs with different names in different exams, we should just let the frontend use ExamEnrollment's UID.
            enrollments.append(enroll_dict)
            
        return enrollments

    async def remove_student_from_exam(self, session: AsyncSession, exam_uid: str, student_uid: str, admin_uid: str):
        from src.db.models import ExamEnrollment
        # Verify exam ownership first
        exam = await self.get_exam_owned_by(exam_uid, admin_uid, session)
        if not exam:
            return False
            
        statement = select(ExamEnrollment).where(and_(ExamEnrollment.exam_uid == exam_uid, ExamEnrollment.uid == student_uid))
        enrollment = (await session.exec(statement)).first()
        if not enrollment:
            return False
            
        await session.delete(enrollment)
        await session.commit()
        return True

    async def update_enrollment(self, session: AsyncSession, enrollment_uid: str, update_data: StudentUpdateModel, admin_uid: str):
        from src.db.models import ExamEnrollment, Exam
        # Get enrollment and ensure admin owns the exam it belongs to
        statement = select(ExamEnrollment).join(Exam).where(and_(ExamEnrollment.uid == enrollment_uid, Exam.admin_uid == admin_uid))
        enrollment = (await session.exec(statement)).first()
        if not enrollment:
            return None
            
        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(enrollment, key, value)
            
        enrollment.updated_at = datetime.now(timezone.utc)
        
        await session.commit()
        await session.refresh(enrollment)
        return enrollment

    async def get_invitation_list(self, session: AsyncSession, exam_uid: str, admin_uid: str):
        from src.db.models import Exam, ExamEnrollment
        from sqlmodel import or_
        # Verify ownership
        exam = await self.get_exam_owned_by(exam_uid, admin_uid, session)
        if not exam:
            return None, []
            
        # Get all enrollments for this exam that have NOT finished face registration yet
        statement = select(ExamEnrollment).where(
            and_(
                ExamEnrollment.exam_uid == exam_uid,
                or_(ExamEnrollment.status != "enrolled", ExamEnrollment.status == None)
            )
        )
        result = await session.exec(statement)
        return exam, result.all()


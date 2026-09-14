from src.db.models import (
    Exam,
    ExamEnrollment,
    ExamSession,
    ExamEnrollmentStatus,
    ExamStatus,
    Question,
    Options,
    StudentAnswers,
    Snapshot,
    Violation,
    ViolationType,
)
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.exams.service import ExamService
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from fastapi import status
from datetime import datetime, timezone, timedelta
from typing import List
import numpy as np
import uuid
from uuid import UUID
from src.config import Config
from src.students.face_utils import decode_image, get_face_embedding, compute_distance
import logging
import random
from src.core.storage import storage_service
from src.core.crypto import decrypt_embedding
from src.auth.utils import decode_url_safe_token
from itsdangerous import SignatureExpired, BadSignature

logger = logging.getLogger(__name__)
exam_service = ExamService()




class ExamSessionService:
    @staticmethod
    def _resource_uuid(value: str, detail: str) -> UUID:
        try:
            return UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=detail,
            )

    async def get_owned_exam(
        self, exam_uid: str, admin_uid: str, session: AsyncSession
    ) -> Exam:
        """Return an exam only when it belongs to the authenticated admin."""
        exam_id = self._resource_uuid(exam_uid, "Exam not found")
        admin_id = self._resource_uuid(admin_uid, "Exam not found")
        statement = select(Exam).where(
            Exam.uid == exam_id,
            Exam.admin_uid == admin_id,
        )
        result = await session.exec(statement)
        exam = result.first()

        if not exam:
            # Deliberately avoid revealing whether another admin owns this exam.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found",
            )

        return exam

    async def get_owned_session(
        self, session_uid: str, admin_uid: str, session: AsyncSession
    ) -> ExamSession:
        """Return a session only when its exam belongs to the authenticated admin."""
        exam_session_id = self._resource_uuid(session_uid, "Exam session not found")
        admin_id = self._resource_uuid(admin_uid, "Exam session not found")
        statement = (
            select(ExamSession)
            .join(Exam, ExamSession.exam_uid == Exam.uid)
            .where(
                ExamSession.uid == exam_session_id,
                Exam.admin_uid == admin_id,
            )
        )
        result = await session.exec(statement)
        exam_session = result.first()

        if not exam_session:
            # Use one response for absent and foreign-owned sessions.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam session not found",
            )

        return exam_session

    async def get_student_session(
        self,
        session_uid: str,
        exam_uid: str,
        student_uid: str,
        session: AsyncSession,
        *,
        for_update: bool = False,
    ) -> ExamSession:
        """Return only the session scoped to this signed student identity."""
        exam_session_id = self._resource_uuid(session_uid, "Exam session not found")
        exam_id = self._resource_uuid(exam_uid, "Exam session not found")
        enrollment_id = self._resource_uuid(student_uid, "Exam session not found")
        statement = select(ExamSession).where(
            ExamSession.uid == exam_session_id,
            ExamSession.exam_uid == exam_id,
            ExamSession.student_uid == enrollment_id,
        )
        if for_update:
            statement = statement.with_for_update()
        result = await session.exec(statement)
        exam_session = result.first()

        if not exam_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam session not found",
            )

        return exam_session

    async def verify_live_face(
        self, live_image_base64: str, stored_embedding: List[float]
    ) -> bool:
        """
        Verify a single live image against the stored averaged enrollment embedding.
        stored_embedding is a decrypted 128-d float array held only in memory.
        Uses Config.FACE_SIMILARITY_THRESHOLD — never a hardcoded value.
        """
        image_array = decode_image(live_image_base64)
        live_embedding = get_face_embedding(image_array)
        stored_array = np.array(stored_embedding)
        distance = compute_distance(stored_array, live_embedding)
        return distance < Config.FACE_SIMILARITY_THRESHOLD


    async def start_exam(
        self,
        exam_uid: str,
        student_uid: str,
        face_image_base64: str,
        session: AsyncSession,
    ):
        exam = await exam_service.get_an_exam(exam_uid, session)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found"
            )

        enrollment_statement = select(ExamEnrollment).where(
            ExamEnrollment.uid == student_uid, ExamEnrollment.exam_uid == exam_uid
        )
        result = await session.exec(enrollment_statement)
        enrollment = result.first()

        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not enrolled for this exam",
            )
        if enrollment.status != ExamEnrollmentStatus.enrolled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please complete face registration before starting the exam",
            )

        # Verify live face against enrolled face
        if not enrollment.embedding_vector:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No face registered. Please complete face registration first.",
            )

        try:
            stored_embedding = decrypt_embedding(enrollment.embedding_vector)
        except ValueError:
            logger.exception(
                "Stored face embedding could not be decrypted",
                extra={"enrollment_uid": str(enrollment.uid)},
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Face verification is temporarily unavailable",
            )

        # Perform live face verification
        face_match = await self.verify_live_face(
            live_image_base64=face_image_base64,
            stored_embedding=stored_embedding,
        )

        if not face_match:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Face verification failed. Live image does not match enrolled face.",
            )

        current_time = datetime.now(timezone.utc)
        if current_time < exam.start_time:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Exam has not yet started"
            )
        if current_time > exam.end_time:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Exam has already ended"
            )

        existing_session = await session.exec(
            select(ExamSession).where(
                ExamSession.student_uid == student_uid, ExamSession.exam_uid == exam_uid
            )
        )
        if existing_session.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Exam session already exists",
            )

        initial_expected_end_time = datetime.now(timezone.utc) + timedelta(
            minutes=exam.duration_minutes
        )
        expected_end_time = min(initial_expected_end_time, exam.end_time)

        new_session = ExamSession(
            student_uid=student_uid,
            exam_uid=exam_uid,
            start_time=datetime.now(timezone.utc),
            expected_end_time=expected_end_time,
            end_time=None,
            status=ExamStatus.in_progress,
        )

        session.add(new_session)
        await session.commit()
        await session.refresh(new_session)

        logger.info(
            "Exam session started",
            extra={
                "session_uid": str(new_session.uid),
                "exam_uid": str(new_session.exam_uid),
                "enrollment_uid": str(new_session.student_uid),
                "expected_end_time": expected_end_time.isoformat(),
            },
        )

        return new_session, exam

    async def choose_options(
        self,
        exam_session_uid: str,
        exam_uid: str,
        student_uid: str,
        question_uid: str,
        selected_option_uids: list[str],
        session: AsyncSession,
    ):
        exam_session = await self.get_student_session(
            exam_session_uid,
            exam_uid,
            student_uid,
            session,
            for_update=True,
        )

        if exam_session.status != ExamStatus.in_progress:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exam session is not active",
            )

        if (
            exam_session.expected_end_time is None
            or datetime.now(timezone.utc) > exam_session.expected_end_time
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The answer deadline has passed",
            )

        statement = select(Question).where(
            Question.uid == question_uid,
            Question.exam_uid == exam_session.exam_uid,
        )
        result = await session.exec(statement)
        question = result.first()

        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question not found for this exam",
            )

        if selected_option_uids:
            result = await session.exec(
                select(Options).where(
                    Options.uid.in_(selected_option_uids),
                    Options.question_uid == question_uid,
                )
            )
            options = result.all()
            if len(options) != len(selected_option_uids):
                raise HTTPException(
                    400,
                    "One or more selected options are invalid for this question",
                )

        result = await session.exec(
            select(StudentAnswers).where(
                StudentAnswers.session_uid == exam_session.uid,
                StudentAnswers.question_uid == question_uid,
            )
        )
        existing_answer = result.first()

        if existing_answer:
            existing_answer.selected_option_uids = selected_option_uids
            existing_answer.updated_at = datetime.now(timezone.utc)
            session.add(existing_answer)
            await session.commit()
            await session.refresh(existing_answer)

            return {
                "message": "Answer updated successfully",
                "answer_uid": existing_answer.uid,
            }

        else:
            new_answer = StudentAnswers(
                session_uid=exam_session.uid,
                question_uid=question.uid,
                selected_option_uids=selected_option_uids,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )

            session.add(new_answer)
            await session.commit()
            await session.refresh(new_answer)

            return {
                "message": "Answer saved successfully",
                "answer_uid": new_answer.uid,
            }

    async def submit_exam(
        self,
        session_uid: str,
        exam_uid: str,
        student_uid: str,
        session: AsyncSession,
    ):

        exam_session = await self.get_student_session(
            session_uid,
            exam_uid,
            student_uid,
            session,
            for_update=True,
        )

        if exam_session.status == ExamStatus.submitted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Exam has already been submitted",
            )

        if exam_session.status != ExamStatus.in_progress:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Exam session is not in progress",
            )

        current_time = datetime.now(timezone.utc)
        if exam_session.expected_end_time is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Exam session has no completion deadline",
            )

        # The deadline is authoritative. If this request arrives just after it,
        # finalize at the deadline instead of leaving the session in progress
        # until the periodic reconciliation task runs.
        exam_session.end_time = min(current_time, exam_session.expected_end_time)
        exam_session.status = ExamStatus.submitted

        # Commit so the background worker sees the submitted state
        session.add(exam_session)
        await session.commit()
        await session.refresh(exam_session)

        # Queue grading after the committed submission becomes visible to workers.
        # If Redis is briefly unavailable, the periodic completion task will find
        # this submitted-but-ungraded session and enqueue it again.
        from src.worker.tasks.grading_tasks import grade_and_notify_task

        try:
            grade_and_notify_task.delay(str(exam_session.uid))
        except Exception:
            logger.exception(
                "Could not enqueue grading; periodic reconciliation will retry",
                extra={"session_uid": str(exam_session.uid)},
            )

        return exam_session



    async def validate_exam_link(self, token: str, session: AsyncSession) -> dict:
        """
        Decode an exam entry token and return exam timing info + open/not_yet_open/expired status.
        Does NOT require student identity — timing check only.
        """
    
        try:
            # Exam tokens are long-lived (valid as long as the URL exists).
            # We validate timing against exam.start_time / exam.end_time instead of token age.
            data = decode_url_safe_token(token, max_age=60 * 60 * 24 * 365)  # 1-year max age
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or tampered exam link.",
            )

        exam_uid = data.get("exam_uid")
        if not exam_uid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed exam link.",
            )

        exam = await exam_service.get_an_exam(exam_uid, session)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found.",
            )

        now = datetime.now(timezone.utc)
        # Check if student has already submitted
        student_uid = data.get("student_uid")
        link_status = "open"
        
        if student_uid:
            session_stmt = select(ExamSession).where(
                ExamSession.student_uid == student_uid,
                ExamSession.exam_uid == exam_uid
            )
            res = await session.exec(session_stmt)
            existing_session = res.first()
            if existing_session and existing_session.status == ExamStatus.submitted:
                link_status = "submitted"

        if link_status != "submitted":
            if now < exam.start_time:
                link_status = "not_yet_open"
            elif now > exam.end_time:
                link_status = "expired"
            else:
                link_status = "open"

        return {
            "valid": True,
            "exam_uid": str(exam.uid),
            "enrollment_uid": data.get("student_uid"), # Extract from token
            "exam_title": exam.title,
            "exam_start_time": exam.start_time,
            "exam_end_time": exam.end_time,
            "duration_minutes": exam.duration_minutes,
            "status": link_status,
        }

    async def get_exam_questions_for_student(
        self,
        session_uid: str,
        exam_uid: str,
        student_uid: str,
        session: AsyncSession,
    ) -> dict:
        """
        Returns all exam questions + options (is_correct stripped) for an active student session.
        Also returns saved_answers for reconnect recovery.
        student_uid = enrollment_uid (ExamEnrollment.uid)
        """
        # 1. Verify active session
        exam_session = await self.get_student_session(
            session_uid, exam_uid, student_uid, session
        )

        if exam_session.status == ExamStatus.submitted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This exam has already been submitted.",
            )

        # 1.5 Fetch Exam settings
        exam_stmt = select(Exam).where(Exam.uid == exam_session.exam_uid)
        exam_result = await session.exec(exam_stmt)
        exam = exam_result.first()
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found.",
            )

        # 2. Fetch questions ordered by order_index
        from src.db.models import Options as OptionsModel
        questions_stmt = (
            select(Question)
            .where(Question.exam_uid == exam_session.exam_uid)
            .order_by(Question.order_index)
        )
        result = await session.exec(questions_stmt)
        questions = list(result.all())

        if exam.shuffle_questions:
            seed_str = f"{student_uid}-{exam_uid}"
            rng = random.Random(seed_str)
            rng.shuffle(questions)

        # 3. Fetch all options for these exam questions (strip is_correct)
        question_uids = [str(q.uid) for q in questions]
        options_stmt = select(OptionsModel).where(
            OptionsModel.question_uid.in_(question_uids)
        )
        result = await session.exec(options_stmt)
        all_options = result.all()

        # Group options by question_uid
        options_by_question: dict[str, list] = {}
        for opt in all_options:
            key = str(opt.question_uid)
            if key not in options_by_question:
                options_by_question[key] = []
            options_by_question[key].append({
                "uid": str(opt.uid),
                "option_text": opt.option_text,
                "order_index": opt.order_index,
            })

        # Sort or Shuffle options within each question
        for key in options_by_question:
            if exam.shuffle_options:
                seed_str = f"{student_uid}-{key}"
                rng = random.Random(seed_str)
                rng.shuffle(options_by_question[key])
            else:
                options_by_question[key].sort(key=lambda x: x["order_index"])

        # 4. Build questions list
        questions_out = []
        for q in questions:
            questions_out.append({
                "uid": str(q.uid),
                "question_text": q.question_text,
                "order_index": q.order_index,
                "options": options_by_question.get(str(q.uid), []),
            })

        # 5. Fetch saved answers for this session (reconnect recovery)
        from src.db.models import StudentAnswers as StudentAnswersModel
        answers_stmt = select(StudentAnswersModel).where(
            StudentAnswersModel.session_uid == exam_session.uid
        )
        result = await session.exec(answers_stmt)
        saved = result.all()

        saved_answers: dict[str, list] = {}
        for ans in saved:
            saved_answers[str(ans.question_uid)] = ans.selected_option_uids

        # 6. Fetch Student Identity
        from src.db.models import ExamEnrollment
        enroll_stmt = select(ExamEnrollment).where(
            ExamEnrollment.uid == exam_session.student_uid
        )
        res = await session.exec(enroll_stmt)
        enrollment = res.first()

        return {
            "exam_uid": str(exam_uid),
            "session_uid": str(exam_session.uid),
            "expected_end_time": exam_session.expected_end_time,
            "questions": questions_out,
            "student_first_name": enrollment.first_name if enrollment else "",
            "student_last_name": enrollment.last_name if enrollment else "",
            "student_id": enrollment.student_id if enrollment else "",
            "saved_answers": saved_answers,
        }
 
    async def record_violation(
        self,
        session_uid: str,
        exam_uid: str,
        student_uid: str,
        violation_type: str,
        metadata: dict,
        session: AsyncSession,
    ):
        exam_session = await self.get_student_session(
            session_uid, exam_uid, student_uid, session
        )

        if exam_session.status != ExamStatus.in_progress:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Exam session is not active",
            )

        # 2. Record violation
        # Map frontend strings to backend Enum
        v_type = ViolationType.tab_switch
        v_str = violation_type.lower()
        
        if "tab" in v_str: v_type = ViolationType.tab_switch
        elif "focus" in v_str: v_type = ViolationType.focus_loss
        elif "no_face" in v_str: v_type = ViolationType.no_face
        elif "multiple" in v_str: v_type = ViolationType.multiple_faces
        elif "mismatch" in v_str: v_type = ViolationType.face_mismatch
        
        new_violation = Violation(
            uid=uuid.uuid4(),
            student_uid=exam_session.student_uid,
            session_uid=exam_session.uid,
            violation_type=v_type.value if hasattr(v_type, 'value') else v_type, 
            timestamp=datetime.now(timezone.utc),
        )
        session.add(new_violation)
        await session.flush()
        await session.commit()
        logger.info(
            "Violation saved",
            extra={"violation_type": v_type.value, "session_uid": str(exam_session.uid)},
        )

    async def verify_face_loop(
        self,
        session_uid: str,
        exam_uid: str,
        student_uid: str,
        live_image_base64: str,
        session: AsyncSession,
    ):
        # 1. Bind both enrollment and active session to the signed token scope.
        exam_session = await self.get_student_session(
            session_uid, exam_uid, student_uid, session
        )

        enrollment_stmt = select(ExamEnrollment).where(
            ExamEnrollment.uid == exam_session.student_uid,
            ExamEnrollment.exam_uid == exam_session.exam_uid,
        )
        result = await session.exec(enrollment_stmt)
        enrollment = result.first()

        if not enrollment or exam_session.status != ExamStatus.in_progress:
            raise HTTPException(404, "Active session not found")

        # 2. Dispatch the Heavy Face Inference to Celery
        from src.worker.tasks.face_tasks import verify_face_task
        verify_face_task.delay(
            session_uid=str(exam_session.uid),
            enrollment_uid=str(student_uid),
            live_image_base64=live_image_base64
        )

        return {
            "status": "queued",
            "message": "Face verification queued",
            "violation_type": None,
            "face_match": None,
            "num_faces": None,
        }

    async def identify_student(
        self, exam_uid: str, identifier: str, session: AsyncSession
    ) -> dict:
        """
        Identify a student by email or student ID within a specific exam.
        Returns the same structure as validate_exam_link but with enrollment_uid.
        """
        from sqlmodel import or_
 
        exam = await exam_service.get_an_exam(exam_uid, session)
        if not exam:
            raise HTTPException(404, "Exam not found")
 
        # For student IDs, "046" is the same as "46"
        stripped_identifier = identifier.lstrip("0") or "0"

        statement = select(ExamEnrollment).where(
            ExamEnrollment.exam_uid == exam_uid,
            or_(
                ExamEnrollment.email == identifier,
                ExamEnrollment.student_id == identifier,
                ExamEnrollment.student_id == stripped_identifier,
            ),
        )
        result = await session.exec(statement)
        enrollment = result.first()
 
        if not enrollment:
            raise HTTPException(404, "No enrollment found with this Email or Student ID.")
 
        if enrollment.status != ExamEnrollmentStatus.enrolled:
            raise HTTPException(403, "Please complete face registration using your enrollment link first.")
 
        # Check if already submitted
        session_stmt = select(ExamSession).where(
            ExamSession.student_uid == str(enrollment.uid),
            ExamSession.exam_uid == exam_uid
        )
        res = await session.exec(session_stmt)
        existing_session = res.first()
        
        # Re-use the validation logic for timing
        now = datetime.now(timezone.utc)
        link_status = "open"
        if existing_session and existing_session.status == ExamStatus.submitted:
            link_status = "submitted"
        elif now < exam.start_time:
            link_status = "not_yet_open"
        elif now > exam.end_time:
            link_status = "expired"
        else:
            link_status = "open"
 
        return {
            "valid": True,
            "exam_uid": str(exam.uid),
            "enrollment_uid": str(enrollment.uid),
            "exam_title": exam.title,
            "exam_start_time": exam.start_time,
            "exam_end_time": exam.end_time,
            "duration_minutes": exam.duration_minutes,
            "status": link_status,
        }

    async def update_session_score(
        self,
        session_uid: str,
        new_score: float,
        reason: str,
        admin_uid: str,
        session: AsyncSession,
    ):
        """
        Manually update a student's score and record the reason.
        """
        from src.db.models import Question
        exam_session = await self.get_owned_session(session_uid, admin_uid, session)

        # Fetch exam for total questions to update percentage
        exam_stmt = select(Question).where(Question.exam_uid == exam_session.exam_uid)
        res = await session.exec(exam_stmt)
        questions = res.all()
        total_possible_marks = sum(q.marks for q in questions)

        exam_session.score = new_score
        if total_possible_marks > 0:
            exam_session.score_percentage = (new_score / total_possible_marks) * 100
        exam_session.adjustment_reason = reason

        session.add(exam_session)
        await session.commit()
        await session.refresh(exam_session)
        return exam_session

    async def get_exam_results(
        self, exam_uid: str, admin_uid: str, session: AsyncSession
    ):
        """
        Fetch all sessions for an exam with student details and violation counts.
        """
        from sqlalchemy import func
        from src.db.models import Violation

        owned_exam = await self.get_owned_exam(exam_uid, admin_uid, session)

        # Get total marks
        q_stmt = select(func.sum(Question.marks)).where(Question.exam_uid == owned_exam.uid)
        q_res = await session.exec(q_stmt)
        total_marks = q_res.first() or 0

        # Fetch all sessions for this exam
        stmt = (
            select(ExamSession, ExamEnrollment)
            .join(ExamEnrollment, ExamSession.student_uid == ExamEnrollment.uid)
            .where(ExamSession.exam_uid == owned_exam.uid)
        )
        result = await session.exec(stmt)
        rows = result.all()

        out = []
        for exam_session, enrollment in rows:
            # Get detailed violation summary
            v_stmt = select(Violation.violation_type).where(Violation.session_uid == exam_session.uid)
            v_res = await session.exec(v_stmt)
            violations = v_res.all()

            # Extract string values from ViolationType enums for comparison
            violation_values = [
                v.value if hasattr(v, 'value') else str(v) for v in violations
            ]

            summary_parts = []
            tab_switches = violation_values.count("tab_switch")
            focus_losses = violation_values.count("focus_loss")
            face_mismatches = violation_values.count("face_mismatch")
            no_faces = violation_values.count("no_face")
            multiple_faces = violation_values.count("multiple_faces")

            if tab_switches > 0: summary_parts.append(f"Tab Switch: {tab_switches}")
            if focus_losses > 0: summary_parts.append(f"Focus Loss: {focus_losses}")
            if face_mismatches > 0: summary_parts.append(f"Face Mismatch: {face_mismatches}")
            if no_faces > 0: summary_parts.append(f"No Face: {no_faces}")
            if multiple_faces > 0: summary_parts.append(f"Multiple Faces: {multiple_faces}")

            violation_summary = ", ".join(summary_parts) if summary_parts else "None"

            out.append({
                "session_uid": str(exam_session.uid),
                "student_uid": str(enrollment.uid),
                "student_name": f"{enrollment.first_name} {enrollment.last_name}",
                "student_id": enrollment.student_id,
                "email": enrollment.email,
                "status": exam_session.status.value if hasattr(exam_session.status, 'value') else str(exam_session.status),
                "score": exam_session.score,
                "total_marks": total_marks,
                "score_percentage": exam_session.score_percentage,
                "adjustment_reason": exam_session.adjustment_reason,
                "violation_count": len(violations),
                "violation_summary": violation_summary,
                "end_time": exam_session.end_time.isoformat() if exam_session.end_time else None,
            })

        return out

    async def get_session_details(
        self, session_uid: str, admin_uid: str, session: AsyncSession
    ):
        """
        Fetch full details for a specific session, including all violations with timestamps.
        """

        owned_session = await self.get_owned_session(session_uid, admin_uid, session)

        # 1. Fetch Session & Enrollment
        stmt = (
            select(ExamSession, ExamEnrollment)
            .join(ExamEnrollment, ExamSession.student_uid == ExamEnrollment.uid)
            .where(ExamSession.uid == owned_session.uid)
        )
        result = await session.exec(stmt)
        row = result.first()
        
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
            
        exam_session, enrollment = row
        
        # 2. Fetch Violations
        v_stmt = select(Violation).where(Violation.session_uid == exam_session.uid).order_by(Violation.timestamp)
        v_res = await session.exec(v_stmt)
        violations = v_res.all()
        
        # 3. Fetch retained violation evidence only. Clean frames are not evidence,
        # and expired rows remain hidden even if cleanup has not run yet.
        retention_cutoff = datetime.now(timezone.utc) - timedelta(
            days=Config.SNAPSHOT_RETENTION_DAYS
        )
        s_stmt = select(Snapshot).where(
            Snapshot.session_uid == exam_session.uid,
            Snapshot.violation_type.is_not(None),
            Snapshot.timestamp > retention_cutoff,
        ).order_by(Snapshot.timestamp)
        s_res = await session.exec(s_stmt)
        snapshots = s_res.all()

        # 4. Fetch total marks
        from sqlalchemy import func
        q_count_stmt = select(func.sum(Question.marks)).where(Question.exam_uid == exam_session.exam_uid)
        q_res = await session.exec(q_count_stmt)
        total_marks = q_res.first() or 0
        
        return {
            "session_uid": str(exam_session.uid),
            "student_name": f"{enrollment.first_name} {enrollment.last_name}",
            "student_id": enrollment.student_id,
            "email": enrollment.email,
            "start_time": exam_session.start_time.isoformat() if exam_session.start_time else None,
            "end_time": exam_session.end_time.isoformat() if exam_session.end_time else None,
            "status": exam_session.status.value if hasattr(exam_session.status, 'value') else str(exam_session.status),
            "score": exam_session.score,
            "total_marks": total_marks,
            "score_percentage": exam_session.score_percentage,
            "adjustment_reason": exam_session.adjustment_reason,
            "violations": [
                {
                    "type": v.violation_type.value if hasattr(v.violation_type, 'value') else str(v.violation_type),
                    "time": v.timestamp.isoformat() if v.timestamp else None,
                    "metadata": None,
                } for v in violations
            ],
            "snapshots": [
                {
                    "url": f"{Config.DOMAIN}/api/v1/exam_session/storage/snapshot/{s.session_uid}/{s.uid}",
                    "face_matches": s.face_matches,
                    "multiple_faces": s.multiple_faces_detected,
                    "time": s.timestamp.isoformat() if s.timestamp else None,
                    "violation_type": s.violation_type,
                    "occurrence_count": s.occurrence_count if s.occurrence_count else 1,
                    "last_seen_at": s.last_seen_at.isoformat() if s.last_seen_at else None,
                } for s in snapshots
            ]
        }

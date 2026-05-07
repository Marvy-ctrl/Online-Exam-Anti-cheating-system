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
import base64
import face_recognition
import numpy as np
from PIL import Image
import io
from uuid import UUID
exam_service = ExamService()


class ExamSessionService:
    async def verify_live_face(
        self, live_image_base64: str, stored_embedding: List[float]
    ) -> bool:
        try:
            image_data = base64.b64decode(live_image_base64)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid base64 image data",
            )

        # 2. Convert image data to numpy array
        try:
            # Load image from bytes
            image = Image.open(io.BytesIO(image_data))
            # Convert to RGB if needed (face_recognition requires RGB)
            if image.mode != "RGB":
                image = image.convert("RGB")
            # Convert PIL Image to numpy array
            image_array = np.array(image)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image format: {str(e)}",
            )

        # 3. Detect faces in the image
        face_locations = face_recognition.face_locations(image_array)

        if len(face_locations) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No face detected in the image. Please ensure your face is clearly visible.",
            )

        if len(face_locations) > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple faces detected. Please submit an image with only your face.",
            )

        # 4. Generate face embedding
        face_encodings = face_recognition.face_encodings(image_array, face_locations)

        if len(face_encodings) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to generate face encoding. Please try with a clearer image.",
            )

        # Get the live face embedding as numpy array
        live_embedding = face_encodings[0]
        # Convert stored embedding from list to numpy array
        stored_embedding_array = np.array(stored_embedding)
        # Calculate distance between embeddings
        distance = face_recognition.face_distance(
            [stored_embedding_array], live_embedding
        )[0]
      
        threshold = 0.50
        return distance < threshold

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

        # Perform live face verification
        face_match = await self.verify_live_face(
            live_image_base64=face_image_base64,
            stored_embedding=enrollment.embedding_vector,
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
        # Log for debugging
        print(f"DEBUG: Exam duration_minutes: {exam.duration_minutes}")
        print(f"DEBUG: Exam title: {exam.title}")

        initial_expected_end_time = datetime.now(timezone.utc) + timedelta(
            minutes=exam.duration_minutes
        )
        expected_end_time = min(initial_expected_end_time, exam.end_time)

        # min_remaining = (
        #     expected_end_time - datetime.now(timezone.utc)
        # ).total_seconds() / 60

        print(f"DEBUG: Start time: {datetime.now(timezone.utc)}")
        print(f"DEBUG: Expected end time: {expected_end_time}")
        print(
            f"DEBUG: Difference in minutes: {(expected_end_time - datetime.now(timezone.utc)).total_seconds() / 60}"
        )

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

        return new_session, exam

    async def choose_options(
        self,
        exam_session_uid: str,
        student_uid: str,
        question_uid: str,
        selected_option_uids: list[str],
        session: AsyncSession,
    ):
        statement = select(ExamSession).where(ExamSession.uid == exam_session_uid)
        result = await session.exec(statement)
        exam_session = result.first()

        if not exam_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam session not found",
            )

        if exam_session.status != ExamStatus.in_progress:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exam session is not active",
            )

        statement = select(ExamEnrollment).where(
            ExamEnrollment.uid == student_uid,
            ExamEnrollment.exam_uid == exam_session.exam_uid,
        )
        result = await session.exec(statement)
        enrollment = result.first()

        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student is not enrolled for this exam",
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
                StudentAnswers.session_uid == exam_session_uid,
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
                session_uid=exam_session_uid,
                question_uid=question_uid,
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

    async def submit_exam(self, exam_uid: str, student_uid: str, session: AsyncSession):

        exam = await exam_service.get_an_exam(exam_uid, session)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found"
            )

        session_statement = select(ExamSession).where(
            ExamSession.student_uid == student_uid, ExamSession.exam_uid == exam_uid
        )
        result = await session.exec(session_statement)
        exam_session = result.first()

        if not exam_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam session not found. Please start the exam first.",
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

        if current_time > exam_session.expected_end_time:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Submission deadline has passed. Expected end time was {exam_session.expected_end_time.isoformat()}",
            )

        exam_session.end_time = current_time
        exam_session.status = ExamStatus.submitted

        # Perform Autograding
        await self.autograde_session(exam_session, session)

        session.add(exam_session)
        await session.commit()
        await session.refresh(exam_session)

        return exam_session

    async def autograde_session(self, exam_session: ExamSession, session: AsyncSession):
        """
        Calculate score for the session by comparing student answers to correct options.
        """
        from src.db.models import Question, Options, StudentAnswers

        # 1. Fetch all questions for this exam
        questions_stmt = select(Question).where(Question.exam_uid == exam_session.exam_uid)
        result = await session.exec(questions_stmt)
        questions = result.all()
        total_questions = len(questions)

        if total_questions == 0:
            exam_session.score = 0
            exam_session.score_percentage = 0
            return

        # 2. Fetch all student answers for this session
        answers_stmt = select(StudentAnswers).where(StudentAnswers.session_uid == exam_session.uid)
        result = await session.exec(answers_stmt)
        student_answers = {str(a.question_uid): a.selected_option_uids for a in result.all()}

        earned_marks = 0
        total_possible_marks = sum(q.marks for q in questions)

        # 3. For each question, find correct options and compare
        for q in questions:
            options_stmt = select(Options).where(Options.question_uid == q.uid, Options.is_correct == True)
            result = await session.exec(options_stmt)
            correct_option_uids = [str(o.uid) for o in result.all()]
            
            student_selected = student_answers.get(str(q.uid), [])

            # Simple exact match check (works for single and multiple choice)
            if set(student_selected) == set(correct_option_uids) and len(correct_option_uids) > 0:
                earned_marks += q.marks

        exam_session.score = float(earned_marks)
        if total_possible_marks > 0:
            exam_session.score_percentage = (earned_marks / total_possible_marks) * 100
        else:
            exam_session.score_percentage = 0

    async def validate_exam_link(self, token: str, session: AsyncSession) -> dict:
        """
        Decode an exam entry token and return exam timing info + open/not_yet_open/expired status.
        Does NOT require student identity — timing check only.
        """
        from src.auth.utils import decode_url_safe_token
        from itsdangerous import SignatureExpired, BadSignature

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
        session_stmt = select(ExamSession).where(
            ExamSession.student_uid == student_uid,
            ExamSession.exam_uid == exam_uid,
        )
        result = await session.exec(session_stmt)
        exam_session = result.first()

        if not exam_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active exam session found. Please start the exam first.",
            )

        if exam_session.status == ExamStatus.submitted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This exam has already been submitted.",
            )

        # 2. Fetch questions ordered by order_index
        from src.db.models import Options as OptionsModel
        questions_stmt = (
            select(Question)
            .where(Question.exam_uid == exam_uid)
            .order_by(Question.order_index)
        )
        result = await session.exec(questions_stmt)
        questions = result.all()

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

        # Sort options within each question
        for key in options_by_question:
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
            StudentAnswersModel.session_uid == str(exam_session.uid)
        )
        result = await session.exec(answers_stmt)
        saved = result.all()

        saved_answers: dict[str, list] = {}
        for ans in saved:
            saved_answers[str(ans.question_uid)] = ans.selected_option_uids

        # 6. Fetch Student Identity
        from src.db.models import ExamEnrollment
        enroll_stmt = select(ExamEnrollment).where(ExamEnrollment.uid == UUID(student_uid))
        res = await session.exec(enroll_stmt)
        enrollment = res.first()

        return {
            "exam_uid": str(exam_uid),
            "session_uid": str(exam_session.uid),
            "questions": questions_out,
            "student_first_name": enrollment.first_name if enrollment else "",
            "student_last_name": enrollment.last_name if enrollment else "",
            "student_id": enrollment.student_id if enrollment else "",
            "saved_answers": saved_answers,
        }
 
    async def record_violation(
        self,
        exam_uid: str,
        student_uid: str,
        violation_type: str,
        metadata: dict,
        session: AsyncSession,
    ):
        # 1. Get session (Ensure we cast to UUID for the query)
        session_stmt = select(ExamSession).where(
            ExamSession.student_uid == UUID(student_uid),
            ExamSession.exam_uid == UUID(exam_uid),
            ExamSession.status == ExamStatus.in_progress,
        )
        result = await session.exec(session_stmt)
        exam_session = result.first()
        
        if not exam_session:
            print(f" No active session found for violation: student={student_uid} exam={exam_uid}")
            return

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
            student_uid=UUID(student_uid),
            session_uid=exam_session.uid,
            violation_type=v_type.value, # Explicitly use .value to match DB enum strings
            timestamp=datetime.now(timezone.utc),
        )
        session.add(new_violation)
        await session.commit()
        print(f"✅ Logged {v_type.value} for session {exam_session.uid}")

    async def verify_face_loop(
        self,
        exam_uid: str,
        student_uid: str,
        live_image_base64: str,
        session: AsyncSession,
    ):
        # 1. Get enrollment and session
        enrollment_stmt = select(ExamEnrollment).where(ExamEnrollment.uid == student_uid)
        result = await session.exec(enrollment_stmt)
        enrollment = result.first()

        session_stmt = select(ExamSession).where(
            ExamSession.student_uid == student_uid,
            ExamSession.exam_uid == exam_uid,
            ExamSession.status == ExamStatus.in_progress,
        )
        result = await session.exec(session_stmt)
        exam_session = result.first()

        if not enrollment or not exam_session:
            raise HTTPException(404, "Active session not found")

        # 2. Process image
        try:
            image_data = base64.b64decode(live_image_base64)
            image = Image.open(io.BytesIO(image_data))
            if image.mode != "RGB":
                image = image.convert("RGB")
            image_array = np.array(image)
        except Exception:
            raise HTTPException(400, "Invalid image data")

        # 3. Detect faces
        # Using model="hog" and upsampling once to find smaller/farther faces
        face_locations = face_recognition.face_locations(image_array, number_of_times_to_upsample=1)
        num_faces = len(face_locations)
        print(f"Face check result: {num_faces} faces found")
        
        violation_type = None
        face_match = True

        if num_faces == 0:
            violation_type = ViolationType.no_face
            face_match = False
        elif num_faces > 1:
            violation_type = ViolationType.multiple_faces
            face_match = False
        else:
            # 4. Verify Identity
            face_encodings = face_recognition.face_encodings(image_array, face_locations)
            if face_encodings:
                stored_embedding = np.array(enrollment.embedding_vector)
                distance = face_recognition.face_distance([stored_embedding], face_encodings[0])[0]
                if distance > 0.60: # Threshold
                    violation_type = ViolationType.face_mismatch
                    face_match = False

        # 5. Log Violation & Snapshot if needed
        if violation_type or num_faces > 1:
            # In a real system, we'd save the image to S3/Disk. Here we'll just log.
            # We use the base64 as a placeholder for image_path in this demo/MVP
            new_snapshot = Snapshot(
                student_uid=UUID(student_uid),
                session_uid=exam_session.uid,
                image_path=f"data:image/jpeg;base64,{live_image_base64[:50]}...", # Truncated for DB
                face_matches=face_match,
                multiple_faces_detected=(num_faces > 1),
                timestamp=datetime.now(timezone.utc),
            )
            session.add(new_snapshot)

            new_violation = Violation(
                student_uid=UUID(student_uid),
                session_uid=exam_session.uid,
                violation_type=violation_type or ViolationType.multiple_faces,
                timestamp=datetime.now(timezone.utc),
            )
            session.add(new_violation)
            await session.commit()

        return {
            "status": "ok" if not violation_type else "violation",
            "message": "Identity verified" if not violation_type else f"Violation detected: {violation_type}",
            "violation_type": violation_type,
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
 
        statement = select(ExamEnrollment).where(
            ExamEnrollment.exam_uid == exam_uid,
            or_(
                ExamEnrollment.email == identifier,
                ExamEnrollment.student_id == identifier,
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
        self, session_uid: str, new_score: float, reason: str, session: AsyncSession
    ):
        """
        Manually update a student's score and record the reason.
        """
        from src.db.models import Question
        statement = select(ExamSession).where(ExamSession.uid == UUID(session_uid))
        result = await session.exec(statement)
        exam_session = result.first()

        if not exam_session:
            raise HTTPException(404, "Exam session not found")

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

    async def get_exam_results(self, exam_uid: str, session: AsyncSession):
        """
        Fetch all sessions for an exam with student details and violation counts.
        """
        from sqlalchemy import func
        from src.db.models import Violation

        # Fetch all sessions for this exam
        stmt = (
            select(ExamSession, ExamEnrollment)
            .join(ExamEnrollment, ExamSession.student_uid == ExamEnrollment.uid)
            .where(ExamSession.exam_uid == UUID(exam_uid))
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
                "score_percentage": exam_session.score_percentage,
                "adjustment_reason": exam_session.adjustment_reason,
                "violation_count": len(violations),
                "violation_summary": violation_summary,
                "end_time": exam_session.end_time.isoformat() if exam_session.end_time else None,
            })

        return out

    async def get_session_details(self, session_uid: str, session: AsyncSession):
        """
        Fetch full details for a specific session, including all violations with timestamps.
        """
        # 1. Fetch Session & Enrollment
        stmt = (
            select(ExamSession, ExamEnrollment)
            .join(ExamEnrollment, ExamSession.student_uid == ExamEnrollment.uid)
            .where(ExamSession.uid == UUID(session_uid))
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
        
        # 3. Fetch Snapshots
        s_stmt = select(Snapshot).where(Snapshot.session_uid == exam_session.uid).order_by(Snapshot.timestamp)
        s_res = await session.exec(s_stmt)
        snapshots = s_res.all()
        
        return {
            "session_uid": str(exam_session.uid),
            "student_name": f"{enrollment.first_name} {enrollment.last_name}",
            "student_id": enrollment.student_id,
            "email": enrollment.email,
            "start_time": exam_session.start_time.isoformat() if exam_session.start_time else None,
            "end_time": exam_session.end_time.isoformat() if exam_session.end_time else None,
            "status": exam_session.status.value if hasattr(exam_session.status, 'value') else str(exam_session.status),
            "score": exam_session.score,
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
                    "url": s.image_path,
                    "face_matches": s.face_matches,
                    "multiple_faces": s.multiple_faces_detected,
                    "time": s.timestamp.isoformat() if s.timestamp else None
                } for s in snapshots
            ]
        }

    async def send_result_to_student(self, session_uid: str, session: AsyncSession):
        from src.auth.email import send_exam_result_email
        from src.db.models import Exam, ExamEnrollment
        
        stmt = select(ExamSession, Exam, ExamEnrollment).join(
            Exam, ExamSession.exam_uid == Exam.uid
        ).join(
            ExamEnrollment, ExamSession.student_uid == ExamEnrollment.uid
        ).where(ExamSession.uid == session_uid)
        
        result = await session.exec(stmt)
        row = result.first()
        
        if not row:
            return None
            
        exam_session, exam, enrollment = row
        
        return {
            "email": enrollment.email,
            "student_name": f"{enrollment.first_name} {enrollment.last_name}",
            "exam_title": exam.title,
            "score": exam_session.score,
            "percentage": exam_session.score_percentage
        }

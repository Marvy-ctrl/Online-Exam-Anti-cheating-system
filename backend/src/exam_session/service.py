from src.db.models import (
    Exam,
    ExamEnrollment,
    ExamSession,
    ExamEnrollmentStatus,
    ExamStatus,
    Question,
    Options,
    StudentAnswers,
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
        threshold = 0.60
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

        # Validate selected options if any are provided
        if selected_option_uids:
            # Check for duplicates
            unique_option_uids = list(set(selected_option_uids))
            if len(unique_option_uids) != len(selected_option_uids):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Duplicate options detected. Each option can only be selected once.",
                )

            # Validate options exist and belong to this question
            result = await session.exec(
                select(Options).where(
                    Options.uid.in_(selected_option_uids),
                    Options.question_uid == question_uid,
                )
            )
            options = result.all()

            if len(options) != len(selected_option_uids):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One or more selected options are invalid for this question",
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
                exam_session_uid=exam_session_uid,
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

        session.add(exam_session)
        await session.commit()
        await session.refresh(exam_session)

        return exam_session

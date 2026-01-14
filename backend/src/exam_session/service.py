from src.db.models import (
    Exam,
    ExamEnrollment,
    ExamSession,
    ExamEnrollmentStatus,
    ExamStatus,
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

    async def submit_exam(self, exam_uid: str, student_uid: str, session: AsyncSession):
        """Submit an exam session and mark it as completed."""
        # Get the exam
        exam = await exam_service.get_an_exam(exam_uid, session)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found"
            )

        # Get the exam session
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

        # Check if already submitted
        if exam_session.status == ExamStatus.submitted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Exam has already been submitted",
            )

        # Check if exam session is in progress
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

        # Update the session
        exam_session.end_time = current_time
        exam_session.status = ExamStatus.submitted

        session.add(exam_session)
        await session.commit()
        await session.refresh(exam_session)

        return exam_session

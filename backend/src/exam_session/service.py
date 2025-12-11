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

        # Convert numpy array to list for database storage
        live_embedding = face_encodings[0].tolist()
        distance = face_recognition.face_distance([stored_embedding], live_embedding)[0]
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

        # Check exam timing
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
        session_end_time = datetime.now(timezone.utc) + timedelta(
            minutes=exam.duration_minutes
        )

        new_session = ExamSession(
            student_uid=student_uid,
            exam_uid=exam_uid,
            start_time=datetime.now(timezone.utc),
            end_time=session_end_time,
            status=ExamStatus.in_progress,
        )

        session.add(new_session)
        await session.commit()
        await session.refresh(new_session)

        return new_session, exam

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from fastapi import HTTPException, status
from datetime import datetime
from src.db.models import ExamEnrollment
from src.auth.utils import decode_url_safe_token
from .schema import StudentEnrollModel
from datetime import datetime, timezone, timedelta
from src.exams.service import ExamService
import base64
import face_recognition
import numpy as np
from PIL import Image
import io

exam_service = ExamService()


class StudentService:
    async def verify_enrollment_link(self, token: str, session: AsyncSession):
        try:
            token_data = decode_url_safe_token(token)
            exam_uid = token_data.get("exam_uid")
            if not exam_uid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid token",
                )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired token",
            )

        exam = await exam_service.get_an_exam(exam_uid, session)
        if not exam:
            raise HTTPException(404, "Exam not found")

        def local_to_utc(dt: datetime):
            WAT = timezone(timedelta(hours=1))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=WAT)
            return dt.astimezone(timezone.utc)

        now = datetime.now(timezone.utc)
        start = local_to_utc(exam.link_start_time) if exam.link_start_time else None
        end = local_to_utc(exam.link_end_time) if exam.link_end_time else None

        if start and now < start:
            raise HTTPException(400, "Enrollment has not started yet")

        if end and now > end:
            raise HTTPException(400, "Enrollment link has expired")
            
        return exam_uid

    async def enroll_student(
        self,
        token: str,
        enrollment_input: StudentEnrollModel,
        client_ip: str,
        session: AsyncSession,
    ):
        exam_uid = await self.verify_enrollment_link(token, session)

        statement = select(ExamEnrollment).where(
            ExamEnrollment.exam_uid == exam_uid,
            ExamEnrollment.first_name == enrollment_input.first_name,
            ExamEnrollment.last_name == enrollment_input.last_name,
            ExamEnrollment.student_id == enrollment_input.student_id,
            ExamEnrollment.email == enrollment_input.email,
        )
        result = await session.exec(statement)
        enrollment_record = result.first()
        if not enrollment_record:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not registered for this exam",
            )

        if (
            enrollment_record.device_id
            and enrollment_record.device_id != enrollment_input.device_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This student has already enrolled on another device",
            )

        if enrollment_record.status == "enrolled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You have already completed face registration. You cannot re-enroll or change your face.",
            )

        enrollment_record.device_id = (
            enrollment_input.device_id or enrollment_record.device_id
        )
        enrollment_record.ip_address = client_ip
        if enrollment_input.embedding_vector:
            enrollment_record.embedding_vector = enrollment_input.embedding_vector
        if enrollment_input.face_s3_url:
            enrollment_record.face_s3_url = enrollment_input.face_s3_url
        enrollment_record.status = "pending"
        enrollment_record.updated_at = datetime.now()

        session.add(enrollment_record)
        await session.commit()
        await session.refresh(enrollment_record)

        return enrollment_record

    async def register_face(
        self,
        enrollment_uid: str,
        face_image_base64: str,
        session: AsyncSession,
    ):
        """
        Register student face for enrollment.
        Processes face image, generates embedding, and updates enrollment record.
        """

        # 1. Decode base64 image (DO THIS BEFORE DATABASE OPERATIONS)
        try:
            image_data = base64.b64decode(face_image_base64)
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
        face_embedding = face_encodings[0].tolist()

        # 5. NOW fetch enrollment record from database (AFTER processing)
        statement = select(ExamEnrollment).where(ExamEnrollment.uid == enrollment_uid)
        result = await session.exec(statement)
        enrollment_record = result.first()

        if not enrollment_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found"
            )

        if enrollment_record.status == "enrolled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Face registration is already complete for this enrollment.",
            )

        # 6. Update enrollment record with face embedding
        enrollment_record.embedding_vector = face_embedding
        enrollment_record.updated_at = datetime.now()
        enrollment_record.status = "enrolled"

        session.add(enrollment_record)
        await session.commit()
        await session.refresh(enrollment_record)

        return {
            "message": "Face registered successfully",
            "enrollment_uid": enrollment_uid,
            "exam_uid": enrollment_record.exam_uid,
            "face_registered": True,
            "embedding_vector_length": len(face_embedding),
        }

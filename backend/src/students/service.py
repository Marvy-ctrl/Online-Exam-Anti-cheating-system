import logging
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from fastapi import HTTPException, status
from datetime import datetime, timezone, timedelta
from uuid import UUID
from src.db.models import ExamEnrollment
from src.auth.utils import create_url_safe_token, decode_url_safe_token
from .schema import StudentEnrollModel
from .face_utils import decode_image, check_image_quality, get_face_embedding, average_embeddings
from src.config import Config
from src.core.crypto import encrypt_embedding
from src.exams.service import ExamService

logger = logging.getLogger(__name__)
exam_service = ExamService()




class StudentService:
    FACE_REGISTRATION_TOKEN_MAX_AGE = 60 * 60

    @staticmethod
    def create_face_registration_token(enrollment: ExamEnrollment) -> str:
        """Create a signed, purpose-specific handoff to biometric enrollment."""
        return create_url_safe_token(
            {
                "purpose": "face_enrollment",
                "enrollment_uid": str(enrollment.uid),
                "exam_uid": str(enrollment.exam_uid),
            }
        )

    async def verify_face_registration_token(
        self, token: str, session: AsyncSession
    ) -> ExamEnrollment:
        """Resolve a face token to its exact enrollment without trusting client IDs."""
        try:
            token_data = decode_url_safe_token(
                token,
                max_age=self.FACE_REGISTRATION_TOKEN_MAX_AGE,
            )
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired face registration token",
            )

        if not isinstance(token_data, dict) or token_data.get("purpose") != "face_enrollment":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid face registration token",
            )

        try:
            enrollment_uid = UUID(token_data["enrollment_uid"])
            exam_uid = UUID(token_data["exam_uid"])
        except (KeyError, TypeError, ValueError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid face registration token",
            )

        await self.verify_enrollment_window(str(exam_uid), session)

        statement = select(ExamEnrollment).where(
            ExamEnrollment.uid == enrollment_uid,
            ExamEnrollment.exam_uid == exam_uid,
        )
        result = await session.exec(statement)
        enrollment = result.first()
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enrollment not found",
            )

        return enrollment

    async def verify_enrollment_window(
        self, exam_uid: str, session: AsyncSession
    ) -> None:
        """Require the exam's configured enrollment window to be open."""
        exam = await exam_service.get_an_exam(exam_uid, session)
        if not exam:
            raise HTTPException(404, "Exam not found")

        def local_to_utc(dt: datetime):
            wat = timezone(timedelta(hours=1))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=wat)
            return dt.astimezone(timezone.utc)

        now = datetime.now(timezone.utc)
        start = local_to_utc(exam.link_start_time) if exam.link_start_time else None
        end = local_to_utc(exam.link_end_time) if exam.link_end_time else None

        if start and now < start:
            raise HTTPException(400, "Enrollment has not started yet")

        if end and now > end:
            raise HTTPException(400, "Enrollment link has expired")

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

        await self.verify_enrollment_window(exam_uid, session)
            
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
        enrollment_record.status = "pending"
        enrollment_record.updated_at = datetime.now()

        session.add(enrollment_record)
        await session.commit()
        await session.refresh(enrollment_record)

        return enrollment_record

    async def register_face(
        self,
        enrollment_token: str,
        face_images_base64: list[str],
        session: AsyncSession,
    ) -> dict:
        """
        Register student face using multiple images.

        Process:
        1. Fetch the enrollment record and verify it hasn't already been enrolled.
        2. For each submitted image:
           a. Decode from base64.
           b. Run quality checks (brightness + blur). Skip failures, log reason.
           c. Detect exactly one face and generate a 128-d embedding.
           d. Skip images where detection or encoding fails.
        3. Require at least Config.FACE_ENROLLMENT_MIN_PASSING images to have passed.
        4. Average all passing embeddings into a single representative vector.
        5. Store the averaged vector and mark enrollment as 'enrolled'.

        This approach produces a more robust face template than single-image capture,
        significantly reducing impostor acceptance.
        """
        # 1. Resolve the enrollment exclusively from the signed handoff token.
        enrollment_record = await self.verify_face_registration_token(
            enrollment_token, session
        )
        enrollment_uid = str(enrollment_record.uid)

        if enrollment_record.status == "enrolled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Face registration is already complete. You cannot re-enroll.",
            )

        # 2. Process each image — quality gate + encode
        passing_embeddings = []
        skip_reasons = []

        for idx, b64_image in enumerate(face_images_base64):
            step_label = f"Image {idx + 1}"
            try:
                image_array = decode_image(b64_image)
            except HTTPException as e:
                skip_reasons.append(f"{step_label}: decode error — {e.detail}")
                continue

            passed, reason = check_image_quality(image_array)
            if not passed:
                skip_reasons.append(f"{step_label}: quality check failed — {reason}")
                logger.info(
                    "Face enrollment quality check failed",
                    extra={"step": idx + 1, "reason": reason, "enrollment_uid": enrollment_uid},
                )
                continue

            try:
                embedding = get_face_embedding(image_array)
                passing_embeddings.append(embedding)
            except HTTPException as e:
                skip_reasons.append(f"{step_label}: face detection failed — {e.detail}")
                continue

        # 3. Enforce minimum passing image requirement
        num_passing = len(passing_embeddings)
        if num_passing < Config.FACE_ENROLLMENT_MIN_PASSING:
            logger.warning(
                "Face enrollment failed: insufficient passing images",
                extra={
                    "enrollment_uid": enrollment_uid,
                    "passing": num_passing,
                    "required": Config.FACE_ENROLLMENT_MIN_PASSING,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Only {num_passing} of {len(face_images_base64)} images passed quality "
                    f"checks. At least {Config.FACE_ENROLLMENT_MIN_PASSING} are required. "
                    "Please retake in a well-lit area and hold the camera steady."
                ),
            )

        # 4. Average the passing embeddings
        averaged_vector = average_embeddings(passing_embeddings)
        face_embedding_list = averaged_vector.tolist()

        # 5. Encrypt the averaged biometric template before persistence. Raw
        # embeddings exist only in process memory during this request.
        enrollment_record.embedding_vector = encrypt_embedding(face_embedding_list)
        enrollment_record.updated_at = datetime.now(timezone.utc)
        enrollment_record.status = "enrolled"

        session.add(enrollment_record)
        await session.commit()
        await session.refresh(enrollment_record)

        logger.info(
            "Face enrollment complete",
            extra={
                "enrollment_uid": enrollment_uid,
                "images_submitted": len(face_images_base64),
                "images_passed": num_passing,
                # Never log the embedding vector itself
            },
        )

        return {
            "message": "Face registered successfully.",
            "enrollment_uid": enrollment_uid,
            "exam_uid": str(enrollment_record.exam_uid),
            "face_registered": True,
            "images_submitted": len(face_images_base64),
            "images_passed_quality": num_passing,
            "embedding_vector_length": len(face_embedding_list),
        }

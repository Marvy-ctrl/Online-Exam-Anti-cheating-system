from fastapi import APIRouter, Depends, status, Request
from fastapi.exceptions import HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from .schema import (
    StudentEnrollModel,
    StudentEnrollResponse,
    FaceRegisterModel,
    FaceRegisterResponse,
)
from .service import StudentService


student_router = APIRouter()
student_service = StudentService()


# Put specific routes BEFORE parameterized routes to avoid conflicts
@student_router.post(
    "/enroll/face", response_model=FaceRegisterResponse, status_code=status.HTTP_200_OK
)
async def register_face(
    face_data: FaceRegisterModel,
    session: AsyncSession = Depends(get_session),
):
    """
    Multi-image face enrollment endpoint.
    Accepts 3-5 base64 images and stores a single averaged embedding.
    """
    result = await student_service.register_face(
        enrollment_uid=str(face_data.enrollment_uid),
        face_images_base64=face_data.face_images,
        session=session,
    )

    return result


@student_router.post(
    "/enroll/{token}",
    response_model=StudentEnrollResponse,
    status_code=status.HTTP_200_OK,
)
async def student_enroll(
    token: str,
    enrollment_input: StudentEnrollModel,
    request: Request,
    session: AsyncSession = Depends(get_session),
):

    client_ip = request.client.host if request.client else "unknown"

    enrollment_record = await student_service.enroll_student(
        token=token,
        enrollment_input=enrollment_input,
        client_ip=client_ip,
        session=session,
    )

    return enrollment_record

@student_router.get(
    "/enroll/{token}/validate",
    status_code=status.HTTP_200_OK,
)
async def validate_enrollment_link(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Validate if the enrollment link is active before showing the form.
    """
    exam_uid = await student_service.verify_enrollment_link(
        token=token,
        session=session,
    )
    return {"valid": True, "exam_uid": exam_uid}

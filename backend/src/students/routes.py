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
    Register student face for enrollment.
    Accepts base64-encoded face image and updates enrollment record.
    """
    result = await student_service.register_face(
        enrollment_uid=str(face_data.enrollment_uid),
        face_image_base64=face_data.face_image,
        session=session,
    )

    return result


@student_router.post(
    "/enroll/{token}",
    response_model=StudentEnrollResponse,
    status_code=status.HTTP_200_OK,
)
async def enroll_student(
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

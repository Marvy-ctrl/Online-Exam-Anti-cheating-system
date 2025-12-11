from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from .service import ExamSessionService
from .schema import StartExamRequest, StartExamResponse

exam_session_router = APIRouter()
session_service = ExamSessionService()


@exam_session_router.post(
    "/{exam_uid}/student/{student_uid}/start", response_model=StartExamResponse
)
async def start_exam(
    exam_uid: str,
    student_uid: str,
    request_data: StartExamRequest,
    session: AsyncSession = Depends(get_session),
):

    exam_session, exam = await session_service.start_exam(
        exam_uid=exam_uid,
        student_uid=student_uid,
        face_image_base64=request_data.face_image,
        session=session,
    )

    return StartExamResponse(
        message="Exam started successfully",
        session_uid=exam_session.uid,
        start_time=exam_session.start_time,
        end_time=exam_session.end_time,
        duration_minutes=exam.duration_minutes,
    )

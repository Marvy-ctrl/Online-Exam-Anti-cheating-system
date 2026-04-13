from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from .service import ExamSessionService
from .schema import (
    StartExamRequest,
    StartExamResponse,
    SubmitExamResponse,
    ChooseOptionsRequest,
    ChooseOptionsResponse,
    VerifyFaceRequest,
    VerifyFaceResponse,
)

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
        expected_end_time=exam_session.expected_end_time,
        duration_minutes=exam.duration_minutes,
    )


@exam_session_router.post(
    "/{exam_uid}/student/{student_uid}/questions/{question_uid}/answer",
    response_model=ChooseOptionsResponse,
)
async def choose_options(
    exam_uid: str,
    student_uid: str,
    question_uid: str,
    request_data: ChooseOptionsRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await session_service.choose_options(
        exam_session_uid=request_data.exam_session_uid,
        student_uid=student_uid,
        question_uid=question_uid,
        selected_option_uids=request_data.selected_option_uids,
        session=session,
    )

    return ChooseOptionsResponse(
        message=result["message"], answer_uid=result["answer_uid"]
    )


@exam_session_router.post(
    "/{exam_uid}/student/{student_uid}/submit_answers",
    response_model=SubmitExamResponse,
)
async def submit_answers(
    exam_uid: str, student_uid: str, session: AsyncSession = Depends(get_session)
):
    submit = await session_service.submit_exam(exam_uid, student_uid, session)
    return SubmitExamResponse(
        message="Exam submitted successfully, You may exit the hall now",
        submitted_time=submit.end_time,
    )


@exam_session_router.post(
    "/{exam_uid}/student/{student_uid}/verify-face",
    response_model=VerifyFaceResponse,
)
async def verify_face(
    exam_uid: str,
    student_uid: str,
    request_data: VerifyFaceRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await session_service.verify_face_loop(
        exam_uid=exam_uid,
        student_uid=student_uid,
        live_image_base64=request_data.face_image,
        session=session,
    )

    return VerifyFaceResponse(
        status=result["status"],
        message=result["message"],
        violation_type=result["violation_type"],
    )

import uuid
import json
from src.auth.dependencies import AccessTokenBearer
from src.analytics.router import access_token_bearer
from fastapi import APIRouter, Depends, status, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException, Response, Request
from fastapi.responses import JSONResponse
from src.websocket import manager
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from src.db.models import ExamSession
from .service import ExamSessionService
from .schema import (
    StartExamRequest,
    StartExamResponse,
    SubmitExamResponse,
    ChooseOptionsRequest,
    ChooseOptionsResponse,
    VerifyFaceRequest,
    VerifyFaceResponse,
    ExamQuestionsResponse,
    ExamLinkValidateResponse,
    IdentifyStudentRequest,
    ViolationReportRequest,
    UpdateScoreRequest,
    BulkSendResultsRequest,
)
from datetime import datetime, timezone
from src.auth.email import send_exam_result_email
from src.auth.utils import create_student_token
from src.auth.dependencies import verify_student_session
access_token_bearer = AccessTokenBearer()
exam_session_router = APIRouter()
session_service = ExamSessionService()


@exam_session_router.post(
    "/{exam_uid}/student/{student_uid}/start", response_model=StartExamResponse
)
async def start_exam(
    exam_uid: str,
    student_uid: str,
    request_data: StartExamRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):

    exam_session, exam = await session_service.start_exam(
        exam_uid=exam_uid,
        student_uid=student_uid,
        face_image_base64=request_data.face_image,
        session=session,
    )

    # Issue HttpOnly Student Token valid for the duration of the exam
    token = create_student_token(
        student_uid=student_uid,
        exam_uid=exam_uid,
        session_uid=str(exam_session.uid),
        duration_minutes=exam.duration_minutes
    )
    
    response.set_cookie(
        key="exam_auth_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=exam.duration_minutes * 60
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
    token_data: dict = Depends(verify_student_session),
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
    exam_uid: str,
    student_uid: str,
    response: Response,
    session: AsyncSession = Depends(get_session),
    token_data: dict = Depends(verify_student_session),
):
    submit = await session_service.submit_exam(exam_uid, student_uid, session)
    
    # Clear the session token on submission
    response.delete_cookie("exam_auth_token", secure=True, samesite="none", path="/")
    
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
    token_data: dict = Depends(verify_student_session),
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


@exam_session_router.get(
    "/enter/{token}/validate",
    response_model=ExamLinkValidateResponse,
)
async def validate_exam_link(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Validate an exam entry token. Returns exam timing info and open/not_yet_open/expired status.
    Unauthenticated — used by the student exam entry gate page.
    """
    result = await session_service.validate_exam_link(token=token, session=session)
    return ExamLinkValidateResponse(**result)


@exam_session_router.get(
    "/{exam_uid}/student/{student_uid}/questions",
    response_model=ExamQuestionsResponse,
)
async def get_exam_questions(
    exam_uid: str,
    student_uid: str,
    session: AsyncSession = Depends(get_session),
    token_data: dict = Depends(verify_student_session),
):
    """
    Returns all questions + options (is_correct stripped) for an active student session.
    Also returns saved_answers dict for reconnect/power-loss recovery.
    student_uid = enrollment_uid (ExamEnrollment.uid)
    """
    result = await session_service.get_exam_questions_for_student(
        exam_uid=exam_uid,
        student_uid=student_uid,
        session=session,
    )
    return ExamQuestionsResponse(**result)


@exam_session_router.post(
    "/{exam_uid}/student/{student_uid}/violation",
    response_model=dict,
)
async def log_violation(
    exam_uid: str,
    student_uid: str,
    request_data: ViolationReportRequest,
    session: AsyncSession = Depends(get_session),
    token_data: dict = Depends(verify_student_session),
):
    """
    Log a browser-detected violation (tab switching, window focus loss).
    """
    await session_service.record_violation(
        exam_uid=exam_uid,
        student_uid=student_uid,
        violation_type=request_data.violation_type,
        metadata={"count": request_data.count},
        session=session,
    )

    # Broadcast to admin monitors immediately (Nested format expected by dashboard)
    broadcast_payload = {
        "type": "violation",
        "violation_type": request_data.violation_type,
        "message": f"Browser violation: {request_data.violation_type}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await manager.notify_monitor(exam_uid, {
        "type": "student_update",
        "student_uid": student_uid,
        "data": json.dumps(broadcast_payload)
    })
    return {"message": "Violation logged successfully"}


@exam_session_router.post(
    "/{exam_uid}/identify",
    response_model=ExamLinkValidateResponse,
)
 
 
@exam_session_router.post(
    "/{exam_uid}/identify",
    response_model=ExamLinkValidateResponse,
)
async def identify_student(
    exam_uid: str,
    request_data: IdentifyStudentRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Look up a student's enrollment UID using their Email or Student ID.
    Used for broadcast links where the student identity is not in the URL.
    """
    result = await session_service.identify_student(
        exam_uid=exam_uid,
        identifier=request_data.identifier,
        session=session,
    )
    return ExamLinkValidateResponse(**result)
@exam_session_router.post(
    "/session/{session_uid}/update-score",
    response_model=dict,
)
async def update_score(
    session_uid: str,
    request_data: UpdateScoreRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Admin endpoint to update student score.
    """
    updated_session = await session_service.update_session_score(
        session_uid=session_uid,
        new_score=request_data.new_score,
        reason=request_data.adjustment_reason,
        session=session,
    )
    return {
        "message": "Score updated successfully",
        "new_score": updated_session.score,
        "new_percentage": updated_session.score_percentage
    }


@exam_session_router.get(
    "/{exam_uid}/results",
    response_model=list,
)
async def get_exam_results(
    exam_uid: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Fetch all student results (sessions) for a specific exam.
    """
    return await session_service.get_exam_results(exam_uid, session)


@exam_session_router.get(
    "/session/{session_uid}/details",
    response_model=dict,
)
async def get_session_details(
    session_uid: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Fetch detailed audit log for a specific exam session.
    """
    return await session_service.get_session_details(session_uid, session)


@exam_session_router.post("/session/{session_uid}/send-result")
async def send_result_email(
    session_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    """
    Send the final result to the student via email.
    Enqueues the email sending to a Celery background task.
    """
    # Note: In a production system, we should verify the admin owns the exam
    
    # Check if session exists
    session_statement = select(ExamSession).where(ExamSession.uid == session_uid)
    result = await session.exec(session_statement)
    if not result.first():
        raise HTTPException(status_code=404, detail="Session not found")

    # Enqueue to Celery
    from src.worker.tasks.email_tasks import send_result_email_task
    send_result_email_task.delay(str(session_uid))
    
    return {"message": "Result email queued successfully"}


@exam_session_router.post("/bulk-send-results")
async def bulk_send_results(
    request_data: BulkSendResultsRequest,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    """
    Send final exam results to multiple students in bulk.
    """
    from src.worker.tasks.email_tasks import send_result_email_task
    
    sent_count = 0
    for s_uid in request_data.session_uids:
        # Check if session exists
        session_statement = select(ExamSession).where(ExamSession.uid == s_uid)
        result = await session.exec(session_statement)
        if result.first():
            send_result_email_task.delay(str(s_uid))
            sent_count += 1
            
    return {"message": f"Successfully queued {sent_count} result emails"}


@exam_session_router.websocket("/{exam_uid}/student/{student_uid}/ws")
async def exam_websocket_endpoint(
    websocket: WebSocket,
    exam_uid: str,
    student_uid: str
):
    """
    WebSocket endpoint for real-time exam monitoring.
    Handles student heartbeats and violation broadcasts.
    Requires student_session_token cookie.
    """
    # 1. Accept the connection first so we can close it with a custom code if needed
    await websocket.accept()

    # 2. Extract and validate the token manually since Depends() isn't straightforward for websockets
    token = websocket.cookies.get("exam_auth_token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    from src.auth.utils import decode_token
    try:
        token_data = decode_token(token)
        if token_data.get("role") != "student" or token_data.get("exam_uid") != exam_uid or token_data.get("sub") != student_uid:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token scope")
            return
    except Exception as e:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    await manager.connect_student(websocket, student_uid)
    try:
        while True:
            # Receive message from student (could be heartbeat or browser event)
            data = await websocket.receive_text()
            print(f"📥 Received from student {student_uid}: {data}")
            message = {"type": "student_update", "student_uid": student_uid, "data": data}
            # Broadcast to any monitoring examiners
            await manager.notify_monitor(exam_uid, message)
    except WebSocketDisconnect:
        manager.disconnect_student(websocket, student_uid)
    except Exception as e:
        print(f"WS Error: {e}")
        manager.disconnect_student(websocket, student_uid)


@exam_session_router.websocket("/{exam_uid}/monitor/ws")
async def exam_monitor_websocket_endpoint(
    websocket: WebSocket,
    exam_uid: str
):
    """
    WebSocket endpoint for examiners to monitor an exam in real-time.
    Receives all student updates broadcasted by the manager.
    """
    await manager.connect_monitor(websocket, exam_uid)
    try:
        while True:
            # Monitors usually just listen, but we can handle ping/pong here if needed
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_monitor(websocket, exam_uid)
    except Exception as e:
        print(f"Monitor WS Error: {e}")
        manager.disconnect_monitor(websocket, exam_uid)

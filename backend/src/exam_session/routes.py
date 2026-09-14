import uuid
import json
from pathlib import Path
from src.auth.dependencies import AccessTokenBearer
from fastapi import APIRouter, Depends, status, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
from src.websocket import manager
from src.core.storage import storage_service
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from src.db.models import ExamStatus, Snapshot
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
from datetime import datetime, timedelta, timezone
from src.config import Config
from src.auth.utils import create_student_token
from src.auth.dependencies import verify_student_session
from src.auth.redis import token_in_blocklist
from src.auth.utils import decode_token
from src.dependencies.roles import Role
from src.core.logger import get_logger


access_token_bearer = AccessTokenBearer()
admin_role = Role(["admin"])
exam_session_router = APIRouter()
session_service = ExamSessionService()
logger = get_logger(__name__)


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
    if request_data.exam_session_uid != token_data["session_uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token does not match the requested exam session",
        )

    result = await session_service.choose_options(
        exam_session_uid=token_data["session_uid"],
        exam_uid=exam_uid,
        student_uid=student_uid,
        question_uid=question_uid,
        selected_option_uids=[str(uid) for uid in request_data.selected_option_uids],
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
    submit = await session_service.submit_exam(
        token_data["session_uid"], exam_uid, student_uid, session
    )
    
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
        session_uid=token_data["session_uid"],
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
        session_uid=token_data["session_uid"],
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
        session_uid=token_data["session_uid"],
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
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(admin_role),
):
    """
    Admin endpoint to update student score.
    """
    updated_session = await session_service.update_session_score(
        session_uid=session_uid,
        new_score=request_data.new_score,
        reason=request_data.adjustment_reason,
        admin_uid=str(token_details["user"]["uid"]),
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
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(admin_role),
):
    """
    Fetch all student results (sessions) for a specific exam.
    """
    return await session_service.get_exam_results(
        exam_uid, str(token_details["user"]["uid"]), session
    )


@exam_session_router.get(
    "/session/{session_uid}/details",
    response_model=dict,
)
async def get_session_details(
    session_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(admin_role),
):
    """
    Fetch detailed audit log for a specific exam session.
    """
    return await session_service.get_session_details(
        session_uid, str(token_details["user"]["uid"]), session
    )


@exam_session_router.post("/session/{session_uid}/send-result")
async def send_result_email(
    session_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(admin_role),
):
    """
    Send the final result to the student via email.
    Enqueues the email sending to a Celery background task.
    """
    await session_service.get_owned_session(
        str(session_uid), str(token_details["user"]["uid"]), session
    )

    # Enqueue to Celery
    from src.worker.tasks.email_tasks import send_result_email_task
    send_result_email_task.delay(str(session_uid))
    
    return {"message": "Result email queued successfully"}


@exam_session_router.post("/bulk-send-results")
async def bulk_send_results(
    request_data: BulkSendResultsRequest,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(admin_role),
):
    """
    Send final exam results to multiple students in bulk.
    """
    from src.worker.tasks.email_tasks import send_result_email_task
    
    admin_uid = str(token_details["user"]["uid"])

    # Authorize the complete batch before dispatching any external side effects.
    for s_uid in request_data.session_uids:
        await session_service.get_owned_session(str(s_uid), admin_uid, session)

    for s_uid in request_data.session_uids:
        send_result_email_task.delay(str(s_uid))
            
    return {"message": f"Successfully queued {len(request_data.session_uids)} result emails"}


@exam_session_router.websocket("/{exam_uid}/student/{student_uid}/ws")
async def exam_websocket_endpoint(
    websocket: WebSocket,
    exam_uid: str,
    student_uid: str,
    session: AsyncSession = Depends(get_session),
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

    try:
        token_data = decode_token(token)
        if (
            token_data.get("role") != "student"
            or token_data.get("exam_uid") != exam_uid
            or token_data.get("sub") != student_uid
            or not token_data.get("session_uid")
        ):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token scope")
            return

        exam_session = await session_service.get_student_session(
            token_data["session_uid"], exam_uid, student_uid, session
        )
        if exam_session.status != ExamStatus.in_progress:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Session is not active")
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    await manager.connect_student(websocket, student_uid)
    try:
        while True:
            # Receive message from student (could be heartbeat or browser event)
            data = await websocket.receive_text()
            logger.debug(
                "Student websocket message received",
                student_uid=student_uid,
                message_bytes=len(data.encode("utf-8")),
            )
            message = {"type": "student_update", "student_uid": student_uid, "data": data}
            # Broadcast to any monitoring examiners
            await manager.notify_monitor(exam_uid, message)
    except WebSocketDisconnect:
        manager.disconnect_student(websocket, student_uid)
    except Exception as exc:
        logger.exception(
            "Student websocket failed",
            student_uid=student_uid,
            error_type=type(exc).__name__,
        )
        manager.disconnect_student(websocket, student_uid)


@exam_session_router.websocket("/{exam_uid}/monitor/ws")
async def exam_monitor_websocket_endpoint(
    websocket: WebSocket,
    exam_uid: str,
    session: AsyncSession = Depends(get_session),
):
    """
    WebSocket endpoint for examiners to monitor an exam in real-time.
    Receives all student updates broadcasted by the manager.
    """
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    try:
        token_data = decode_token(token)
        admin_uid = str(token_data["user"]["uid"])
        if (
            token_data.get("role") != "admin"
            or token_data.get("refresh")
            or await token_in_blocklist(token_data["jti"])
        ):
            raise ValueError("Invalid administrator token")
        await session_service.get_owned_exam(exam_uid, admin_uid, session)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return

    await manager.connect_monitor(websocket, exam_uid)
    try:
        while True:
            # Monitors usually just listen, but we can handle ping/pong here if needed
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_monitor(websocket, exam_uid)
    except Exception as exc:
        logger.exception(
            "Exam monitor websocket failed",
            exam_uid=exam_uid,
            error_type=type(exc).__name__,
        )
        manager.disconnect_monitor(websocket, exam_uid)

@exam_session_router.get("/storage/snapshot/{session_uid}/{snapshot_uid}")
async def fetch_snapshot_image(
    session_uid: str,
    snapshot_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(admin_role),
):
    """
    Proxy endpoint to securely stream snapshots from MinIO.
    This prevents AWS signature mismatch issues in local development.
    """
    owned_session = await session_service.get_owned_session(
        session_uid, str(token_details["user"]["uid"]), session
    )

    snapshot_result = await session.exec(
        select(Snapshot).where(
            Snapshot.uid == snapshot_uid,
            Snapshot.session_uid == owned_session.uid,
            Snapshot.violation_type.is_not(None),
            Snapshot.timestamp
            > datetime.now(timezone.utc)
            - timedelta(days=Config.SNAPSHOT_RETENTION_DAYS),
        )
    )
    snapshot = snapshot_result.first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    if (
        snapshot.object_key
        and storage_service.minio_available
        and storage_service.minio_client
    ):
        try:
            response = storage_service.minio_client.get_object(
                storage_service.bucket_name, snapshot.object_key
            )
            return StreamingResponse(response.stream(32 * 1024), media_type="image/jpeg")
        except Exception:
            raise HTTPException(status_code=404, detail="Image not found")

    snapshots_root = (
        Path(__file__).resolve().parents[2] / "uploads" / "snapshots"
    ).resolve()
    local_path = (snapshots_root / session_uid / f"{snapshot.uid}.jpg").resolve()
    if snapshots_root not in local_path.parents or not local_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(local_path, media_type="image/jpeg")

from .service import ExamService
from src.db.main import get_session
from uuid import UUID
from src.auth.dependencies import AccessTokenBearer
from src.auth.utils import create_url_safe_token
from src.dependencies.roles import Role
from fastapi import APIRouter, Depends, status
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from .schema import (
    SubjectResponseModel,
    SubjectCreateModel,
    ExamCreateModel,
    ExamResponseModel,
    ExamModel,
    ExamUpdateModel,
    StudentPreEnrollModel,
    StudentPreEnrollResponseModel,
)
from src.config import Config

exam_router = APIRouter()
exam_service = ExamService()
access_token_bearer = AccessTokenBearer()
role = Role(["admin"])


@exam_router.post("/create_subject", response_model=SubjectResponseModel)
async def create_subject(
    subject_data: SubjectCreateModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):

    new_subject = await exam_service.create_subject(subject_data, session)
    return new_subject


@exam_router.post("/create_exam", response_model=ExamResponseModel)
async def create_exam(
    exam_data: ExamCreateModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = token_details.get("user")["uid"]
    exam_data.admin_uid = admin_uid

    new_exam = await exam_service.create_exam(exam_data, admin_uid, session)
    return new_exam


@exam_router.get("/enroll_link")
async def generate_enroll_link(
    token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    token = create_url_safe_token({"email": email})

    enroll_url = f"http://{Config.DOMAIN}/api/v1/exam/enroll/{token}"
    return {"enroll_link": enroll_url}


@exam_router.get("/get_all_exams")
async def get_all_exams(
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    exams = await exam_service.get_all_exams(session)
    return exams


@exam_router.get("/{exam_uid}", response_model=ExamModel)
async def get_exam(
    exam_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    exam = await exam_service.get_an_exam(exam_uid, session)
    if exam:
        return exam
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")


@exam_router.patch("/{exam_uid}", response_model=ExamResponseModel)
async def update_exam(
    exam_uid: str,
    update_details: ExamUpdateModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = token_details.get("user")["uid"]
    exam = await exam_service.update_exam(
        exam_uid=exam_uid,
        update_data=update_details,
        session=session,
        admin_uid=admin_uid,
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@exam_router.delete("/delete_exam/{exam_uid}")
async def delete_exam(
    exam_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    deleted = await exam_service.delete_exam(exam_uid, session)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found"
        )

    return {"message": "Exam has been deleted successfully"}


@exam_router.post(
    "/{exam_uid}/pre-enroll", response_model=StudentPreEnrollResponseModel
)
async def pre_enroll(
    exam_uid: str,
    student_details: StudentPreEnrollModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):

    if token_details["user"]["role"] != "admin":
        raise HTTPException(403, "Only admins can pre-enroll students")

    enroll = await exam_service.pre_enroll_students(student_details, exam_uid, session)

    if enroll is None:
        raise HTTPException(status_code=404, detail="Exam not found")

    return enroll

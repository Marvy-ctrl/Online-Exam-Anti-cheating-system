from .service import ExamService
from src.db.main import get_session
from uuid import UUID
from src.auth.dependencies import AccessTokenBearer
from src.auth.utils import create_url_safe_token
from src.dependencies.roles import Role
from fastapi import APIRouter, Depends, status, BackgroundTasks
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from .schema import (
    SubjectResponseModel,
    SubjectCreateModel,
    ExamCreateModel,
    ExamResponseModel,
    ExamModel,
    ExamDetailResponseModel,
    ExamUpdateModel,
    StudentPreEnrollModel,
    StudentPreEnrollResponseModel,
    EnrollLinkModel,
    SubjectUpdateModel,
    BulkPreEnrollModel,
    StudentRosterResponseModel,
    StudentUpdateModel,
    ExamInvitationModel,
    BulkUnenrollModel
)
from src.config import Config
from src.auth.email import send_exam_invitation_email, send_exam_link_email

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
    admin_uid = str(token_details.get("user")["uid"])
    new_subject = await exam_service.create_subject(subject_data, admin_uid, session)
    return new_subject


@exam_router.get("/subjects", response_model=list[SubjectResponseModel])
async def get_all_subjects(
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
    institution_uid: str = None,
):
    admin_uid = str(token_details.get("user")["uid"])
    subjects = await exam_service.get_all_subjects(session, admin_uid, institution_uid)
    return subjects

@exam_router.get("/subject/{subject_uid}", response_model=SubjectResponseModel)
async def get_subject(
    subject_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = str(token_details.get("user")["uid"])
    subject = await exam_service.get_subject_owned_by(subject_uid, admin_uid, session)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject

@exam_router.patch("/update_subject/{subject_uid}", response_model=SubjectResponseModel)
async def update_subject(
    subject_uid: str,
    update_data: SubjectUpdateModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = str(token_details.get("user")["uid"])
    subject = await exam_service.update_subject(subject_uid, update_data, session, admin_uid)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found or unauthorized")
    return subject

@exam_router.delete("/delete_subject/{subject_uid}")
async def delete_subject(
    subject_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = str(token_details.get("user")["uid"])
    deleted = await exam_service.delete_subject(subject_uid, admin_uid, session)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found or unauthorized"
        )
    return deleted

@exam_router.post("/create_exam", response_model=ExamResponseModel)
async def create_exam(
    exam_data: ExamCreateModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = token_details.get("user")["uid"]
    new_exam = await exam_service.create_exam(exam_data, admin_uid, session)
    return new_exam


@exam_router.post("/{exam_uid}/enroll_link")
async def generate_enroll_link(
    exam_uid: str,
    link_data: EnrollLinkModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):

    exam = await exam_service.get_an_exam(exam_uid, session)
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found"
        )

    token = create_url_safe_token({"exam_uid": exam_uid})

    enroll_url = f"{Config.FRONTEND_URL}/enroll/{token}"
    exam.enroll_link = enroll_url
    exam.link_start_time = link_data.link_start_time
    exam.link_end_time = link_data.link_end_time

    session.add(exam)
    await session.commit()

    return {
        "enroll_link": enroll_url,
        "exam_uid": exam_uid,
        "exam_title": exam.title,
        "exam_link_start_time": exam.link_start_time.isoformat(),
        "exam_link_end_time": exam.link_end_time.isoformat(),
    }


@exam_router.get("/get_all_exams")
async def get_all_exams(
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
    institution_uid: str = None,
    subject_uid: str = None
):
    admin_uid = str(token_details.get("user")["uid"])
    exams = await exam_service.get_all_exams(session, admin_uid, institution_uid, subject_uid)
    return exams


@exam_router.get("/students", response_model=list[StudentRosterResponseModel])
async def get_institution_students(
    institution_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = str(token_details.get("user")["uid"])
    students = await exam_service.get_students_for_institution(session, institution_uid, admin_uid)
    if students is None:
        raise HTTPException(status_code=404, detail="Institution not found or unauthorized")
    return students


@exam_router.get("/{exam_uid}", response_model=ExamDetailResponseModel)
async def get_exam(
    exam_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    exam = await exam_service.get_exam_with_subject(exam_uid, session)
    if exam:
        return exam
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

@exam_router.get("/{exam_uid}/students", response_model=list[StudentRosterResponseModel])
async def get_exam_students(
    exam_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = str(token_details.get("user")["uid"])
    students = await exam_service.get_students_for_exam(session, exam_uid, admin_uid)
    if students is None:
        raise HTTPException(status_code=404, detail="Exam not found or unauthorized")
    return students


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
    admin_uid = token_details.get("user")["uid"]
    deleted = await exam_service.delete_exam(exam_uid, admin_uid, session)
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
    admin_only=Depends(role),
):
    # Role is already enforced by Depends(role) above — no inline check needed.
    enroll = await exam_service.pre_enroll_students(student_details, exam_uid, session, raise_on_duplicate=True)

    if enroll is None:
        raise HTTPException(status_code=404, detail="Exam not found")

    return enroll

@exam_router.post(
    "/{exam_uid}/bulk-pre-enroll", response_model=list[StudentPreEnrollResponseModel]
)
async def bulk_pre_enroll(
    exam_uid: str,
    bulk_data: BulkPreEnrollModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    results = await exam_service.bulk_pre_enroll_students(bulk_data, exam_uid, session)
    if results is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return results

@exam_router.delete("/{exam_uid}/enrollment/{student_uid}")
async def unenroll_student(
    exam_uid: str,
    student_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role)
):
    admin_uid = str(token_details.get("user")["uid"])
    success = await exam_service.remove_student_from_exam(session, exam_uid, student_uid, admin_uid)
    if not success:
        raise HTTPException(status_code=404, detail="Enrollment not found or unauthorized")
    return {"message": "Student successfully removed from exam"}
    
@exam_router.post("/{exam_uid}/bulk-unenroll")
async def bulk_unenroll_students(
    exam_uid: str,
    unenroll_data: BulkUnenrollModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role)
):
    admin_uid = str(token_details.get("user")["uid"])
    success = await exam_service.bulk_remove_students_from_exam(
        session, exam_uid, unenroll_data.student_uids, admin_uid
    )
    if not success:
        raise HTTPException(status_code=404, detail="Exam not found or unauthorized")
    return {"message": f"Successfully removed {len(unenroll_data.student_uids)} students from exam"}

@exam_router.patch("/students/{student_uid}", response_model=StudentRosterResponseModel)
async def update_enrollment_student(
    student_uid: str,
    update_data: StudentUpdateModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role)
):
    admin_uid = str(token_details.get("user")["uid"])
    updated_enrollment = await exam_service.update_enrollment(session, student_uid, update_data, admin_uid)
    if not updated_enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found or unauthorized")
    return updated_enrollment

@exam_router.post("/{exam_uid}/send-invitations")
async def send_exam_invitations(
    exam_uid: str,
    invitation_data: ExamInvitationModel,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role)
):
    admin_uid = str(token_details.get("user")["uid"])
    exam, enrollments = await exam_service.get_invitation_list(session, exam_uid, admin_uid)
    
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found or unauthorized")
        
    if not exam.enroll_link:
        raise HTTPException(status_code=400, detail="Enrollment link has not been generated for this exam yet.")

    # Queue background tasks for each student
    for student in enrollments:
        if student.email:
            background_tasks.add_task(
                send_exam_invitation_email,
                to_email=student.email,
                exam_title=exam.title,
                enrollment_url=exam.enroll_link,
                custom_message=invitation_data.custom_message
            )
            
    return {"message": f"Invitations are being sent to {len(enrollments)} students."}


@exam_router.post("/{exam_uid}/exam-link")
async def generate_exam_link(
    exam_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    """
    Generate a broadcast exam entry link for enrolled students.
    The link is valid only during exam.start_time → exam.end_time (enforced at entry).
    Token uses a 1-year max_age since timing is validated against the exam window, not token age.
    """
    exam = await exam_service.get_an_exam(exam_uid, session)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    admin_uid = str(token_details.get("user")["uid"])
    if str(exam.admin_uid) != admin_uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorised")

    token = create_url_safe_token({"exam_uid": exam_uid})
    exam_url = f"{Config.FRONTEND_URL}/exam/enter/{token}"

    exam.exam_link = exam_url
    session.add(exam)
    await session.commit()

    return {
        "exam_link": exam_url,
        "exam_uid": exam_uid,
        "exam_title": exam.title,
        "exam_start_time": exam.start_time.isoformat(),
        "exam_end_time": exam.end_time.isoformat(),
    }


@exam_router.post("/{exam_uid}/send-exam-link")
async def send_exam_link(
    exam_uid: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    """
    Send the exam entry link to all enrolled students (status = 'enrolled') via email.
    Runs email sends as background tasks.
    """
    from src.db.models import ExamEnrollment, ExamEnrollmentStatus
    from sqlmodel import select

    exam = await exam_service.get_an_exam(exam_uid, session)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    admin_uid = str(token_details.get("user")["uid"])
    if str(exam.admin_uid) != admin_uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorised")

    if not exam.exam_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam link has not been generated yet. Generate it first.",
        )

    # Only send to students who have completed face registration (enrolled)
    result = await session.exec(
        select(ExamEnrollment).where(
            ExamEnrollment.exam_uid == exam_uid,
            ExamEnrollment.status == ExamEnrollmentStatus.enrolled,
        )
    )
    enrolled_students = result.all()

    if not enrolled_students:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No enrolled students found. Students must complete face registration first.",
        )

    from datetime import timezone, timedelta
    WAT = timezone(timedelta(hours=1))

    for student in enrolled_students:
        # Create a personalized token for this specific student
        token_data = {
            "exam_uid": str(exam_uid),
            "student_uid": str(student.uid)
        }
        personalized_token = create_url_safe_token(token_data)
        personalized_url = f"{Config.FRONTEND_URL}/exam/enter/{personalized_token}"

        # Convert UTC to local (WAT) for display in email
        local_start = exam.start_time.astimezone(WAT) if exam.start_time.tzinfo else exam.start_time.replace(tzinfo=timezone.utc).astimezone(WAT)
        local_end = exam.end_time.astimezone(WAT) if exam.end_time.tzinfo else exam.end_time.replace(tzinfo=timezone.utc).astimezone(WAT)

        background_tasks.add_task(
            send_exam_link_email,
            to_email=student.email,
            student_name=f"{student.first_name} {student.last_name}",
            exam_title=exam.title,
            exam_url=personalized_url,
            exam_start_time=local_start.strftime("%B %d, %Y at %I:%M %p WAT"),
            exam_end_time=local_end.strftime("%B %d, %Y at %I:%M %p WAT"),
        )

    return {
        "message": f"Exam link is being sent to {len(enrolled_students)} enrolled student(s).",
        "recipients": len(enrolled_students),
    }

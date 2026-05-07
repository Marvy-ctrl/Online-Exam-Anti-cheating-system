from fastapi import APIRouter, Depends, status
from typing import List
from .service import QuestionService
from src.exams.service import ExamService
from src.db.main import get_session
from src.auth.dependencies import AccessTokenBearer
from src.dependencies.roles import Role
from fastapi import APIRouter, Depends, status
from fastapi.exceptions import HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from .schema import (
    QuestionUploadModel,
    OptionsUploadModel,
    BulkQuestionUploadModel,
    QuestionUpdateModel,
    BulkDeleteQuestionsModel,
)

questions_router = APIRouter()
question_service = QuestionService()
exam_service = ExamService()
access_token_bearer = AccessTokenBearer()
role = Role(["admin"])


@questions_router.post("/{exam_uid}/upload")
async def upload_questions(
    exam_uid: str,
    questions_data: List[QuestionUploadModel],
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    exam = await exam_service.get_an_exam(exam_uid, session)
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found"
        )

    uploaded_questions = []
    for question_detail in questions_data:
        upload = await question_service.upload_questions(
            question_detail, exam_uid, session
        )
        uploaded_questions.append(
            {
                "uid": str(upload.uid),
                "question_text": upload.question_text,
                "order_index": upload.order_index,
            }
        )

    return {
        "message": f"{len(uploaded_questions)} question(s) uploaded successfully",
        "questions": uploaded_questions,
        "exam_uid": str(exam_uid),
    }


@questions_router.get("/{exam_uid}")
async def get_all_questions(
    exam_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    exam = await exam_service.get_an_exam(exam_uid, session)
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found"
        )

    questions = await question_service.get_all_questions(exam_uid, session)

    return {
        "message": "Questions retrieved successfully",
        "count": len(questions),
        "questions": questions,
    }


@questions_router.get("/question/{question_uid}")
async def get_a_question(
    question_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    question = await question_service.get_a_question(question_uid, session)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Question not found"
        )

    return {"message": "Question retrieved successfully", "question": question}


@questions_router.patch("/{question_uid}")
async def update_question(
    question_uid: str,
    update_details: QuestionUpdateModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    question = await question_service.get_a_question(question_uid, session)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Question not found"
        )

    updated_question = await question_service.update_question(
        question_uid, update_details, session
    )

    if not updated_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update question"
        )

    return {
        "message": "Question updated successfully",
        "question": {
            "uid": str(updated_question.uid),
            "question_text": updated_question.question_text,
            "order_index": updated_question.order_index,
        },
    }


@questions_router.delete("/{question_uid}")
async def delete_question(
    question_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    result = await question_service.delete_question(question_uid, session)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Question not found"
        )

    return result


@questions_router.post("/bulk-delete")
async def bulk_delete_questions(
    delete_data: BulkDeleteQuestionsModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    success = await question_service.bulk_delete_questions(
        delete_data.question_uids, session
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete questions")

    return {"message": f"Successfully deleted {len(delete_data.question_uids)} question(s)"}

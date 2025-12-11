from fastapi import FastAPI
from contextlib import asynccontextmanager
from src.db.main import init_db
from src.db.models import (
    Admin,
    Subject,
    Exam,
    Question,
    ExamSession,
    Snapshot,
    Violation,
    ExamEnrollment,
)
from src.auth.router import auth_router
from src.exams.routes import exam_router
from src.students.routes import student_router
from src.questions.routes import questions_router
from src.exam_session.routes import exam_session_router


@asynccontextmanager
async def life_span(app: FastAPI):
    print("Server is running")
    await init_db()
    yield
    print("Server has stopped")


version = "v1"
app = FastAPI(lifespan=life_span, version=version)


app.include_router(auth_router, prefix=f"/api/{version}/auth", tags=["auth"])
app.include_router(exam_router, prefix=f"/api/{version}/exam", tags=["exam"])
app.include_router(student_router, prefix=f"/api/{version}/student", tags=["student"])
app.include_router(
    questions_router, prefix=f"/api/{version}/questions", tags=["questions"]
)
app.include_router(exam_session_router, prefix="/exam-session", tags=["exam_session"])

from fastapi import FastAPI
from contextlib import asynccontextmanager
from src.db.main import init_db
from src.db.models import (
    Admin,
    Student,
    Subject,
    Exam,
    Question,
    ExamSession,
    Snapshot,
    Violation,
)
from src.auth.router import auth_router


@asynccontextmanager
async def life_span(app: FastAPI):
    print("Server is running")
    await init_db()
    yield
    print("Server has stopped")


version = "v1"
app = FastAPI(lifespan=life_span, version=version)


app.include_router(auth_router, prefix=f"/api/{version}/auth", tags=["auth"])

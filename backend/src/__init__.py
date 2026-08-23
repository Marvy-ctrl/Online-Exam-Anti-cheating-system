from fastapi import FastAPI
from contextlib import asynccontextmanager
from src.db.main import init_db
from src.db.models import (
    Admin,
    Institution,
    Subject,
    Exam,
    Question,
    ExamSession,
    Snapshot,
    Violation,
    ExamEnrollment,
)
from fastapi.middleware.cors import CORSMiddleware
from src.auth.router import auth_router
from src.exams.routes import exam_router
from src.students.routes import student_router
from src.questions.routes import questions_router
from src.exam_session.routes import exam_session_router
from src.institutions.router import institution_router
from src.analytics.router import analytics_router
from src.core.logger import configure_logging, get_logger
from .config import Config
from fastapi.staticfiles import StaticFiles


logger = get_logger(__name__)

@asynccontextmanager
async def life_span(app: FastAPI):
    configure_logging()
    logger.info("Server is starting", version=version)
    await init_db()
    yield
    logger.info("Server is stopping")


version = "v1"
app = FastAPI(
    title="ExamLoc Anti-Cheating API",
    description="A high-integrity REST API for managing online exams with AI-powered proctoring and real-time behavioral monitoring.",
    version=version,
    lifespan=life_span,
    docs_url=f"/api/{version}/docs",
    redoc_url=f"/api/{version}/redoc",
    contact={
        "name": "Popoola Marvellous Ibukunoluwa",
        "url": "https://github.com/Marvy-ctrl",
        "email": "popoolamarvellous51@gmail.com",
    },
    openapi_url=f"/api/{version}/openapi.json",
)

import os
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
UPLOADS_DIR = os.path.join(BACKEND_DIR, "uploads")
os.makedirs(os.path.join(UPLOADS_DIR, "snapshots"), exist_ok=True)

from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory=UPLOADS_DIR), name="static")


def _cors_origins() -> list[str]:
    """Build the CORS allowlist.

    CORSMiddleware compares origins by exact string — it does no subdomain or
    wildcard matching. `https://examloc.xyz` therefore does NOT cover
    `https://www.examloc.xyz`, and a browser on the wrong one gets a preflight
    rejection with no Access-Control-Allow-Origin header. Vercel serves both
    hostnames, so register both forms of whatever FRONTEND_URL is set to.
    """
    from urllib.parse import urlparse

    origins: list[str] = []
    frontend = (Config.FRONTEND_URL or "").rstrip("/")

    if frontend:
        origins.append(frontend)
        parsed = urlparse(frontend)
        host = parsed.netloc
        if host.startswith("www."):
            origins.append(f"{parsed.scheme}://{host[4:]}")
        else:
            origins.append(f"{parsed.scheme}://www.{host}")

    # Local dev origins. Gated on COOKIE_SECURE so they are absent in any HTTPS
    # deployment: allow_credentials=True plus a permitted http://localhost origin
    # would let anything listening on the developer's own port 3000 issue
    # credentialed requests against production using their live session cookies.
    if not Config.COOKIE_SECURE:
        origins += [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://0.0.0.0:3000",
            "http://192.168.0.177:3000",
        ]

    # De-duplicate, preserving order (FRONTEND_URL may already be the www form).
    return list(dict.fromkeys(origins))


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router, prefix=f"/api/{version}/auth", tags=["auth"])
app.include_router(exam_router, prefix=f"/api/{version}/exam", tags=["exam"])
app.include_router(student_router, prefix=f"/api/{version}/student", tags=["student"])
app.include_router(
    questions_router, prefix=f"/api/{version}/questions", tags=["questions"]
)
app.include_router(
    exam_session_router, prefix=f"/api/{version}/exam_session", tags=["exam_session"]
)
app.include_router(
    institution_router, prefix=f"/api/{version}/institutions", tags=["institutions"]
)
app.include_router(
    analytics_router, prefix=f"/api/{version}/analytics", tags=["analytics"]
)

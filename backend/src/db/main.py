from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from src.config import Config
from src.db.models import (
    Admin,
    Subject,
    Exam,
    Question,
    ExamSession,
    Snapshot,
    Violation,
)


async_engine: AsyncEngine = create_async_engine(
    Config.DATABASE_URL, connect_args={"ssl": Config.DB_SSL}
)

async_session_maker = async_sessionmaker(
    bind=async_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session


async def init_db() -> None:
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
from sqlmodel import SQLModel

# Import all models so SQLModel.metadata picks them up for autogenerate
from src.config import Config
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

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata
DATABASE_URL = Config.DATABASE_URL
engine = create_async_engine(DATABASE_URL, future=True, poolclass=pool.NullPool)


def run_migrations_offline() -> None:
    raise NotImplementedError("Offline migrations are not supported for asyncpg")


async def run_migrations_online() -> None:
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations() -> None:
    asyncio.run(run_migrations_online())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations()

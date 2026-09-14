"""Encrypt enrollment face embeddings without discarding existing templates.

Revision ID: c7f2a9d4e6b1
Revises: b94c987f123b
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from src.core.crypto import (
    decrypt_embedding,
    encrypt_embedding,
    validate_encryption_key,
)


revision = "c7f2a9d4e6b1"
down_revision = "b94c987f123b"
branch_labels = None
depends_on = None


def _embedding_column_type(bind):
    columns = sa.inspect(bind).get_columns("enrollment")
    return next(column["type"] for column in columns if column["name"] == "embedding_vector")


def upgrade() -> None:
    bind = op.get_bind()
    current_type = _embedding_column_type(bind)

    # A database initially created from the current SQLModel metadata already
    # has the encrypted TEXT schema. This makes stamping then upgrading safe.
    if isinstance(current_type, (sa.Text, sa.String)):
        return
    if not isinstance(current_type, postgresql.ARRAY):
        raise RuntimeError(
            f"Unsupported enrollment.embedding_vector type: {current_type}"
        )

    validate_encryption_key()
    op.add_column(
        "enrollment",
        sa.Column("embedding_vector_encrypted", sa.Text(), nullable=True),
    )

    rows = bind.execute(
        sa.text(
            "SELECT uid, embedding_vector FROM enrollment "
            "WHERE embedding_vector IS NOT NULL"
        )
    ).mappings()
    for row in rows:
        encrypted = encrypt_embedding(list(row["embedding_vector"]))
        bind.execute(
            sa.text(
                "UPDATE enrollment SET embedding_vector_encrypted = :encrypted "
                "WHERE uid = :uid"
            ),
            {"encrypted": encrypted, "uid": row["uid"]},
        )

    op.drop_column("enrollment", "embedding_vector")
    op.alter_column(
        "enrollment",
        "embedding_vector_encrypted",
        new_column_name="embedding_vector",
    )


def downgrade() -> None:
    bind = op.get_bind()
    current_type = _embedding_column_type(bind)
    if isinstance(current_type, postgresql.ARRAY):
        return
    if not isinstance(current_type, (sa.Text, sa.String)):
        raise RuntimeError(
            f"Unsupported enrollment.embedding_vector type: {current_type}"
        )

    validate_encryption_key()
    op.add_column(
        "enrollment",
        sa.Column(
            "embedding_vector_plaintext",
            postgresql.ARRAY(sa.Float()),
            nullable=True,
        ),
    )

    rows = bind.execute(
        sa.text(
            "SELECT uid, embedding_vector FROM enrollment "
            "WHERE embedding_vector IS NOT NULL"
        )
    ).mappings()
    for row in rows:
        plaintext = decrypt_embedding(row["embedding_vector"])
        bind.execute(
            sa.text(
                "UPDATE enrollment SET embedding_vector_plaintext = :plaintext "
                "WHERE uid = :uid"
            ),
            {"plaintext": plaintext, "uid": row["uid"]},
        )

    op.drop_column("enrollment", "embedding_vector")
    op.alter_column(
        "enrollment",
        "embedding_vector_plaintext",
        new_column_name="embedding_vector",
    )

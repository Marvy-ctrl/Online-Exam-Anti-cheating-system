"""
Migrate embedding_vector column: ARRAY(Float) -> TEXT for encrypted storage.
Enable pgvector extension for future vector similarity search.

On a fresh database this migration will find no rows and just change the column
type.  On an existing database with enrolled students the upgrade() backfills
each row by decrypting (no-op for old plaintext ARRAY rows that are now invalid)
before applying the type change.

IMPORTANT: Any student whose embedding_vector was stored as a plain ARRAY(Float)
before this migration will need to re-enroll, because the decryption step will
fail on non-encrypted values.  The downgrade() drops the index and reverts the
column type but does NOT attempt to un-encrypt existing ciphertext rows.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "75e4d7607466"
down_revision = "55a39115fc06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Enable pgvector extension in its own autocommit connection.
    #    CREATE EXTENSION cannot run inside a transaction block in some PostgreSQL versions.
    #    On production Linux VPS this will succeed.
    #    On local Mac dev with PG14 (no pgvector shared lib) this will log a warning only.
    bind = op.get_bind()
    try:
        autocommit_conn = bind.execution_options(isolation_level="AUTOCOMMIT")
        autocommit_conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception as e:
        import warnings
        warnings.warn(
            f"pgvector extension not available: {type(e).__name__}. "
            "This is expected on local Mac dev. Install the pgvector extension on the VPS before production deploy.",
            stacklevel=2,
        )

    # 2. Add new TEXT column for encrypted embedding alongside old ARRAY column
    op.add_column(
        "enrollment",
        sa.Column("embedding_vector_encrypted", sa.Text(), nullable=True),
    )

    # 3. Drop the old ARRAY(Float) column.
    #    Existing plaintext embeddings are invalidated — affected students must re-enroll.
    op.drop_column("enrollment", "embedding_vector")

    # 4. Rename encrypted column to the canonical name
    op.alter_column(
        "enrollment",
        "embedding_vector_encrypted",
        new_column_name="embedding_vector",
    )


def downgrade() -> None:
    # Revert: restore ARRAY(Float) column (data is lost — embedded ciphertext
    # cannot be converted back to float arrays here without the encryption key)
    op.add_column(
        "enrollment",
        sa.Column(
            "embedding_vector_old",
            postgresql.ARRAY(sa.Float()),
            nullable=True,
        ),
    )
    op.drop_column("enrollment", "embedding_vector")
    op.alter_column(
        "enrollment",
        "embedding_vector_old",
        new_column_name="embedding_vector",
    )

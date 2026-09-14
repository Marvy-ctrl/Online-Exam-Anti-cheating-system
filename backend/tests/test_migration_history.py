import unittest
from pathlib import Path

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory


BACKEND_DIR = Path(__file__).resolve().parents[1]


class MigrationHistoryTests(unittest.TestCase):
    def test_backend_has_one_authoritative_migration_head(self):
        config = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
        scripts = ScriptDirectory.from_config(config)

        self.assertEqual(scripts.get_heads(), ["c7f2a9d4e6b1"])

    def test_encryption_migration_preserves_existing_embeddings(self):
        migration = (
            BACKEND_DIR
            / "alembic"
            / "versions"
            / "c7f2a9d4e6b1_encrypt_face_embeddings.py"
        ).read_text()

        select_position = migration.index("SELECT uid, embedding_vector")
        encrypt_position = migration.index("encrypt_embedding(")
        drop_position = migration.index('op.drop_column("enrollment", "embedding_vector")')
        self.assertLess(select_position, encrypt_position)
        self.assertLess(encrypt_position, drop_position)
        self.assertIn("decrypt_embedding", migration)


if __name__ == "__main__":
    unittest.main()

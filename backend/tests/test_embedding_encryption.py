import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import numpy as np
from sqlalchemy import Text

from src.config import Config
from src.core.crypto import decrypt_embedding, encrypt_embedding
from src.db.models import ExamEnrollment
from src.students.service import StudentService


class EmbeddingCryptoTests(unittest.TestCase):
    def setUp(self):
        self.key_patch = patch.object(Config, "ENCRYPTION_KEY", "01" * 32)
        self.key_patch.start()
        self.embedding = [index / 1000 for index in range(128)]

    def tearDown(self):
        self.key_patch.stop()

    def test_encryption_round_trip_uses_versioned_ciphertext(self):
        encrypted = encrypt_embedding(self.embedding)

        self.assertTrue(encrypted.startswith("v1:"))
        self.assertNotIn("0.001", encrypted)
        self.assertEqual(decrypt_embedding(encrypted), self.embedding)

    def test_random_nonce_produces_distinct_ciphertexts(self):
        first = encrypt_embedding(self.embedding)
        second = encrypt_embedding(self.embedding)

        self.assertNotEqual(first, second)
        self.assertEqual(decrypt_embedding(first), decrypt_embedding(second))

    def test_tampered_ciphertext_is_rejected(self):
        encrypted = encrypt_embedding(self.embedding)
        replacement = "A" if encrypted[-1] != "A" else "B"

        with self.assertRaises(ValueError):
            decrypt_embedding(encrypted[:-1] + replacement)

    def test_invalid_embedding_dimensions_are_rejected(self):
        with self.assertRaises(ValueError):
            encrypt_embedding([0.0] * 127)

    def test_legacy_array_can_be_read_during_migration(self):
        self.assertEqual(decrypt_embedding(self.embedding), self.embedding)


class EmbeddingModelTests(unittest.TestCase):
    def test_embedding_column_is_encrypted_text(self):
        column_type = ExamEnrollment.__table__.c.embedding_vector.type

        self.assertIsInstance(column_type, Text)


class EnrollmentEncryptionTests(unittest.IsolatedAsyncioTestCase):
    async def test_face_registration_encrypts_before_database_write(self):
        service = StudentService()
        enrollment = SimpleNamespace(
            uid=uuid4(),
            exam_uid=uuid4(),
            status="pending",
            embedding_vector=None,
            updated_at=None,
        )
        session = SimpleNamespace(
            add=Mock(),
            commit=AsyncMock(),
            refresh=AsyncMock(),
        )
        embedding = np.arange(128, dtype=float) / 1000

        with (
            patch.object(
                service,
                "verify_face_registration_token",
                new=AsyncMock(return_value=enrollment),
            ),
            patch("src.students.service.decode_image", return_value=np.zeros((1, 1))),
            patch("src.students.service.check_image_quality", return_value=(True, "ok")),
            patch("src.students.service.get_face_embedding", return_value=embedding),
            patch(
                "src.students.service.encrypt_embedding",
                return_value="v1:encrypted-template",
            ) as encrypt,
        ):
            result = await service.register_face(
                enrollment_token="signed-token",
                face_images_base64=["one", "two", "three"],
                session=session,
            )

        encrypt.assert_called_once()
        self.assertEqual(len(encrypt.call_args.args[0]), 128)
        self.assertEqual(enrollment.embedding_vector, "v1:encrypted-template")
        self.assertEqual(enrollment.status, "enrolled")
        self.assertEqual(result["embedding_vector_length"], 128)
        session.commit.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()

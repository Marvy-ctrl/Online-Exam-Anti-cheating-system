import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from src.auth.utils import create_url_safe_token
from src.students.schema import FaceRegisterModel, StudentEnrollModel
from src.students.service import StudentService, exam_service


class _Result:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value


class _Session:
    def __init__(self, value):
        self.value = value
        self.statements = []

    async def exec(self, statement):
        self.statements.append(statement)
        return _Result(self.value)


class FaceEnrollmentTokenTests(unittest.IsolatedAsyncioTestCase):
    async def test_signed_token_resolves_exact_enrollment_and_exam(self):
        enrollment = SimpleNamespace(uid=uuid4(), exam_uid=uuid4())
        token = StudentService.create_face_registration_token(enrollment)
        session = _Session(enrollment)
        exam = SimpleNamespace(link_start_time=None, link_end_time=None)

        with patch.object(
            exam_service,
            "get_an_exam",
            new=AsyncMock(return_value=exam),
        ):
            result = await StudentService().verify_face_registration_token(
                token, session
            )

        self.assertIs(result, enrollment)
        sql = str(session.statements[0])
        self.assertIn("enrollment.uid", sql)
        self.assertIn("enrollment.exam_uid", sql)

    async def test_broadcast_enrollment_token_cannot_register_a_face(self):
        broadcast_token = create_url_safe_token({"exam_uid": str(uuid4())})
        session = _Session(None)

        with self.assertRaises(HTTPException) as raised:
            await StudentService().verify_face_registration_token(
                broadcast_token, session
            )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(session.statements, [])

    async def test_token_for_missing_or_mismatched_enrollment_is_rejected(self):
        enrollment = SimpleNamespace(uid=uuid4(), exam_uid=uuid4())
        token = StudentService.create_face_registration_token(enrollment)
        session = _Session(None)
        exam = SimpleNamespace(link_start_time=None, link_end_time=None)

        with patch.object(
            exam_service,
            "get_an_exam",
            new=AsyncMock(return_value=exam),
        ):
            with self.assertRaises(HTTPException) as raised:
                await StudentService().verify_face_registration_token(
                    token, session
                )

        self.assertEqual(raised.exception.status_code, 404)

    async def test_invalid_token_stops_before_biometric_processing(self):
        service = StudentService()
        with (
            patch.object(
                service,
                "verify_face_registration_token",
                new=AsyncMock(side_effect=HTTPException(400, "Invalid token")),
            ),
            patch("src.students.service.decode_image") as decode_image,
        ):
            with self.assertRaises(HTTPException):
                await service.register_face(
                    enrollment_token="tampered",
                    face_images_base64=["one", "two", "three"],
                    session=AsyncMock(),
                )

        decode_image.assert_not_called()

    async def test_face_token_cannot_outlive_enrollment_window(self):
        enrollment = SimpleNamespace(uid=uuid4(), exam_uid=uuid4())
        token = StudentService.create_face_registration_token(enrollment)
        expired_exam = SimpleNamespace(
            link_start_time=None,
            link_end_time=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        session = _Session(enrollment)

        with patch.object(
            exam_service,
            "get_an_exam",
            new=AsyncMock(return_value=expired_exam),
        ):
            with self.assertRaises(HTTPException) as raised:
                await StudentService().verify_face_registration_token(
                    token, session
                )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, "Enrollment link has expired")
        self.assertEqual(session.statements, [])


class EnrollmentRequestSchemaTests(unittest.TestCase):
    def test_face_request_requires_token_instead_of_enrollment_uid(self):
        with self.assertRaises(ValidationError):
            FaceRegisterModel(
                enrollment_uid=uuid4(),
                face_images=["one", "two", "three"],
            )

    def test_student_cannot_supply_biometric_fields_during_identity_step(self):
        with self.assertRaises(ValidationError):
            StudentEnrollModel(
                first_name="Ada",
                last_name="Lovelace",
                student_id="001",
                email="ada@example.com",
                embedding_vector=[0.0] * 128,
            )


if __name__ == "__main__":
    unittest.main()

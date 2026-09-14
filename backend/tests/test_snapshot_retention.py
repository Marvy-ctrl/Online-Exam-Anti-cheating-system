import unittest
from contextlib import nullcontext
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import numpy as np
from fastapi import HTTPException

from src.db.models import ExamStatus, Snapshot, Violation, ViolationType
from src.core.crypto import encrypt_embedding
from src.exam_session.routes import fetch_snapshot_image, session_service
from src.worker.celery_app import celery_app
from src.worker.tasks.evidence_tasks import purge_snapshot_evidence
from src.worker.tasks.face_tasks import _record_violation, verify_face_task


class _Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def first(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        return self.value


class _Session:
    def __init__(self, values):
        self.values = iter(values)
        self.statements = []
        self.add = Mock()
        self.delete = Mock()
        self.commit = Mock()

    def execute(self, statement):
        self.statements.append(statement)
        return _Result(next(self.values))


class _AsyncSession:
    def __init__(self, value):
        self.value = value
        self.statements = []

    async def exec(self, statement):
        self.statements.append(statement)
        return _Result(self.value)


class CleanFrameMinimizationTests(unittest.TestCase):
    def test_successful_face_match_does_not_store_snapshot(self):
        session_uid = uuid4()
        enrollment_uid = uuid4()
        exam_session = SimpleNamespace(
            uid=session_uid,
            status=ExamStatus.in_progress,
        )
        enrollment = SimpleNamespace(
            uid=enrollment_uid,
            embedding_vector=encrypt_embedding([0.0] * 128),
        )
        db = _Session([exam_session, enrollment])

        with (
            patch.object(verify_face_task, "_session", return_value=nullcontext(db)),
            patch(
                "src.worker.tasks.face_tasks.decode_image",
                return_value=np.zeros((1, 1, 3)),
            ),
            patch(
                "src.worker.tasks.face_tasks.get_face_embedding",
                return_value=np.zeros(128),
            ),
            patch("src.worker.tasks.face_tasks.compute_distance", return_value=0.1),
            patch(
                "src.worker.tasks.face_tasks.storage_service.upload_snapshot"
            ) as upload,
        ):
            result = verify_face_task.run(
                str(session_uid), str(enrollment_uid), "base64-image"
            )

        self.assertTrue(result["face_match"])
        self.assertFalse(result["violation_logged"])
        upload.assert_not_called()
        db.add.assert_not_called()
        db.commit.assert_not_called()


class ViolationEvidenceTests(unittest.TestCase):
    def test_storage_failure_keeps_violation_without_inline_image(self):
        db = _Session([None])

        with patch(
            "src.worker.tasks.face_tasks.storage_service.upload_snapshot",
            side_effect=RuntimeError("storage unavailable"),
        ):
            _record_violation(
                db,
                str(uuid4()),
                str(uuid4()),
                ViolationType.no_face,
                "sensitive-base64-image",
            )

        added = [call.args[0] for call in db.add.call_args_list]
        self.assertEqual(len(added), 1)
        self.assertIsInstance(added[0], Violation)
        self.assertFalse(any(isinstance(value, Snapshot) for value in added))
        db.commit.assert_called_once()

    def test_repeated_violation_reuses_existing_evidence(self):
        existing = SimpleNamespace(
            occurrence_count=2,
            last_seen_at=None,
        )
        db = _Session([existing])

        with patch(
            "src.worker.tasks.face_tasks.storage_service.upload_snapshot"
        ) as upload:
            _record_violation(
                db,
                str(uuid4()),
                str(uuid4()),
                ViolationType.multiple_faces,
                "sensitive-base64-image",
            )

        self.assertEqual(existing.occurrence_count, 3)
        self.assertIsNotNone(existing.last_seen_at)
        upload.assert_not_called()
        db.commit.assert_called_once()


class EvidenceCleanupTests(unittest.TestCase):
    def test_cleanup_deletes_selected_storage_and_database_rows(self):
        now = datetime.now(timezone.utc)
        clean = SimpleNamespace(
            uid=uuid4(),
            session_uid=uuid4(),
            object_key="clean/object.jpg",
            image_path="clean/object.jpg",
        )
        expired = SimpleNamespace(
            uid=uuid4(),
            session_uid=uuid4(),
            object_key=None,
            image_path="/static/snapshots/expired.jpg",
        )
        db = _Session([[clean, expired]])

        with patch(
            "src.worker.tasks.evidence_tasks.storage_service.delete_snapshot",
            return_value=True,
        ) as delete_storage:
            result = purge_snapshot_evidence(db, now)

        self.assertEqual(result, {"deleted": 2, "retryable": 0})
        self.assertEqual(delete_storage.call_count, 2)
        self.assertEqual(db.delete.call_count, 2)
        db.commit.assert_called_once()
        sql = str(db.statements[0])
        self.assertIn("snapshot.violation_type IS NULL", sql)
        self.assertIn("snapshot.image_path LIKE", sql)
        self.assertIn("snapshot.timestamp <=", sql)

    def test_failed_storage_delete_keeps_row_for_retry(self):
        snapshot = SimpleNamespace(
            uid=uuid4(),
            session_uid=uuid4(),
            object_key="evidence/object.jpg",
            image_path="evidence/object.jpg",
        )
        db = _Session([[snapshot]])

        with patch(
            "src.worker.tasks.evidence_tasks.storage_service.delete_snapshot",
            return_value=False,
        ):
            result = purge_snapshot_evidence(db, datetime.now(timezone.utc))

        self.assertEqual(result, {"deleted": 0, "retryable": 1})
        db.delete.assert_not_called()
        db.commit.assert_not_called()

    def test_cleanup_schedule_runs_hourly(self):
        schedule = celery_app.conf.beat_schedule["purge-expired-snapshot-evidence"]

        self.assertEqual(schedule["schedule"], 3600.0)
        self.assertEqual(
            schedule["task"],
            "src.worker.tasks.evidence_tasks.purge_snapshot_evidence_task",
        )


class EvidenceReadPolicyTests(unittest.IsolatedAsyncioTestCase):
    async def test_snapshot_route_hides_clean_and_expired_rows(self):
        exam_session = SimpleNamespace(uid=uuid4())
        db = _AsyncSession(None)

        with patch.object(
            session_service,
            "get_owned_session",
            new=AsyncMock(return_value=exam_session),
        ):
            with self.assertRaises(HTTPException) as raised:
                await fetch_snapshot_image(
                    session_uid=str(exam_session.uid),
                    snapshot_uid=uuid4(),
                    session=db,
                    token_details={"user": {"uid": str(uuid4())}},
                    admin_only=None,
                )

        self.assertEqual(raised.exception.status_code, 404)
        sql = str(db.statements[0])
        self.assertIn("snapshot.violation_type IS NOT NULL", sql)
        self.assertIn("snapshot.timestamp >", sql)


if __name__ == "__main__":
    unittest.main()

"""DB-free Celery task for measuring face inference queue throughput."""

from __future__ import annotations

import json
import os
import time
from functools import lru_cache
from pathlib import Path

import numpy as np
from fastapi import HTTPException

from performance.biometric.evaluate import load_face_utils
from performance.face_worker.celery_app import celery_app


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SAFE_ARTIFACTS_ROOT = (
    REPOSITORY_ROOT / "performance" / "face_worker" / "artifacts"
).resolve()


@lru_cache(maxsize=1)
def _face_utils():
    return load_face_utils()


@lru_cache(maxsize=1)
def _templates() -> dict[str, np.ndarray]:
    configured_path = os.getenv("FACE_BENCHMARK_TEMPLATE_FILE")
    if not configured_path:
        raise RuntimeError("FACE_BENCHMARK_TEMPLATE_FILE is required.")
    template_path = Path(configured_path).expanduser().resolve()
    if not template_path.is_relative_to(SAFE_ARTIFACTS_ROOT):
        raise RuntimeError(
            "FACE_BENCHMARK_TEMPLATE_FILE must be beneath "
            "performance/face_worker/artifacts."
        )
    payload = json.loads(template_path.read_text(encoding="utf-8"))
    templates = payload.get("templates", {})
    if not templates:
        raise RuntimeError("The benchmark template file contains no templates.")
    return {
        subject_id: np.asarray(values, dtype=np.float64)
        for subject_id, values in templates.items()
    }


def _classification(exc: HTTPException) -> str:
    detail = str(exc.detail).lower()
    if "no face" in detail:
        return "no_face"
    if "multiple faces" in detail:
        return "multiple_faces"
    return "encoding_rejected"


@celery_app.task(
    name="performance.face_worker.tasks.verify_face_benchmark",
    queue="face-benchmark",
    soft_time_limit=30,
    time_limit=60,
)
def verify_face_benchmark(
    subject_id: str,
    live_image_base64: str,
    submitted_at_epoch: float,
) -> dict[str, object]:
    """Run the production inference path without DB or evidence writes.

    Neither the embedding nor biometric distance is returned. The result holds
    only an outcome label and timings needed for aggregate performance analysis.
    """

    started_at = time.time()
    outcome = "processed"
    try:
        reference = _templates()[subject_id]
        face_utils = _face_utils()
        image = face_utils.decode_image(live_image_base64)
        live_embedding = face_utils.get_face_embedding(image)
        face_utils.compute_distance(reference, live_embedding)
    except HTTPException as exc:
        outcome = _classification(exc)
    finished_at = time.time()
    return {
        "outcome": outcome,
        "queue_wait_ms": max(0.0, (started_at - submitted_at_epoch) * 1000),
        "processing_ms": (finished_at - started_at) * 1000,
        "worker_end_to_end_ms": max(
            0.0, (finished_at - submitted_at_epoch) * 1000
        ),
        "finished_at_epoch": finished_at,
    }

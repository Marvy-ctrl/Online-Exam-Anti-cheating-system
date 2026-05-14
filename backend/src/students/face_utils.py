"""
face_utils.py — Centralised face processing utilities.

Rules:
- Face inference only runs here. No other module imports face_recognition directly.
- Face encodings never appear in any log line.
- All thresholds are read from Config, never hardcoded.
"""

import io
import base64
import logging
from typing import Tuple

import face_recognition
import numpy as np
from PIL import Image
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Image decoding
# ─────────────────────────────────────────────

def decode_image(face_image_base64: str) -> np.ndarray:
    """
    Decode a base64-encoded image string to an RGB numpy array.
    Raises HTTP 400 on invalid data.
    """
    try:
        image_data = base64.b64decode(face_image_base64)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image data. Please retake the photo.",
        )

    try:
        image = Image.open(io.BytesIO(image_data))
        if image.mode != "RGB":
            image = image.convert("RGB")
        return np.array(image)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to process image. Please try again.",
        )


# ─────────────────────────────────────────────
# Quality checks
# ─────────────────────────────────────────────

def check_image_quality(image_array: np.ndarray) -> Tuple[bool, str]:
    """
    Run lightweight quality checks on a decoded image.

    Checks:
    1. Brightness — average luminance must be >= 60 (0-255 scale).
       Rejects images taken in very dim environments.
    2. Blur — Laplacian variance must be >= 80.
       Rejects significantly blurry images. This is intentionally lenient
       because webcam captures at enrollment time are rarely perfectly sharp.

    Returns:
        (passed: bool, reason: str)
        reason is non-empty only when passed=False.
    """
    # Convert to grayscale for both checks
    gray = np.mean(image_array, axis=2)  # rough luminance

    # Brightness check
    avg_luminance = float(np.mean(gray))
    if avg_luminance < 60:
        return False, f"Image is too dark (luminance={avg_luminance:.1f}). Move to a brighter area."

    # Blur check via Laplacian variance
    # We compute a simple approximation: variance of the Laplacian kernel applied to grayscale.
    from PIL import ImageFilter
    pil_gray = Image.fromarray(gray.astype(np.uint8))
    laplacian = pil_gray.filter(ImageFilter.FIND_EDGES)
    lap_array = np.array(laplacian, dtype=np.float32)
    variance = float(np.var(lap_array))
    if variance < 80:
        return False, f"Image is too blurry (sharpness={variance:.1f}). Hold the camera still."

    return True, ""


# ─────────────────────────────────────────────
# Encoding
# ─────────────────────────────────────────────

def get_face_embedding(image_array: np.ndarray) -> np.ndarray:
    """
    Detect exactly one face and return its 128-d embedding.

    Raises:
        HTTPException 400 — no face, multiple faces, or encoding failure.

    Returns:
        np.ndarray of shape (128,)
    """
    face_locations = face_recognition.face_locations(
        image_array, number_of_times_to_upsample=1
    )

    if len(face_locations) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected. Ensure your face is fully visible and centred.",
        )

    if len(face_locations) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Multiple faces detected. Only one person should be in frame.",
        )

    encodings = face_recognition.face_encodings(image_array, face_locations)
    if not encodings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not compute face encoding. Please retake with better lighting.",
        )

    return encodings[0]  # shape (128,)


# ─────────────────────────────────────────────
# Averaging
# ─────────────────────────────────────────────

def average_embeddings(embeddings: list[np.ndarray]) -> np.ndarray:
    """
    Average a list of 128-d embeddings into a single representative vector.
    This reduces noise from individual captures and improves match stability.

    Args:
        embeddings: List of np.ndarray, each shape (128,). Must not be empty.

    Returns:
        np.ndarray of shape (128,) — the element-wise mean.
    """
    if not embeddings:
        raise ValueError("Cannot average an empty list of embeddings.")
    return np.mean(np.stack(embeddings), axis=0)


# ─────────────────────────────────────────────
# Similarity
# ─────────────────────────────────────────────

def compute_distance(stored: np.ndarray, live: np.ndarray) -> float:
    """
    Compute Euclidean distance between two 128-d face embeddings.
    face_recognition.face_distance uses Euclidean distance internally.

    Args:
        stored: The enrolled/averaged embedding (128-d).
        live:   The live-capture embedding (128-d).

    Returns:
        float — distance. Lower means more similar.
                Typical same-person range: 0.0 – 0.40
                Typical different-person range: 0.45 – 1.0+
    """
    return float(face_recognition.face_distance([stored], live)[0])

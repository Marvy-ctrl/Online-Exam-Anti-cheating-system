"""
core/crypto.py — AES-256-GCM encryption for biometric data.

Rules:
- This is the ONLY module that may encrypt or decrypt face embeddings.
- No other module writes biometric data to the database directly.
- The encryption key is read from Config.ENCRYPTION_KEY (32-byte hex string).
- Nonce is randomly generated per encryption; stored prepended to ciphertext.
- Never log the key, plaintext vectors, or raw ciphertext.
"""

import os
import json
import base64
import logging
import math
from collections.abc import Sequence
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from src.config import Config

logger = logging.getLogger(__name__)

# GCM nonce length in bytes (96-bit is the recommended standard)
_NONCE_BYTES = 12
_EMBEDDING_LENGTH = 128
_FORMAT_PREFIX = "v1:"
_AAD = b"examloc-face-embedding:v1"


def _normalise_embedding(embedding: Sequence[float]) -> list[float]:
    """Validate and copy an embedding without retaining caller-owned memory."""
    try:
        value_count = len(embedding)
    except TypeError as exc:
        raise ValueError("Face embedding must be a numeric sequence.") from exc

    if isinstance(embedding, (str, bytes)) or value_count != _EMBEDDING_LENGTH:
        raise ValueError(f"Face embedding must contain {_EMBEDDING_LENGTH} values.")

    try:
        values = [float(value) for value in embedding]
    except (TypeError, ValueError) as exc:
        raise ValueError("Face embedding contains a non-numeric value.") from exc

    if not all(math.isfinite(value) for value in values):
        raise ValueError("Face embedding contains a non-finite value.")
    return values


def _get_key() -> bytes:
    """
    Derive the 32-byte AES key from Config.ENCRYPTION_KEY.
    The config value must be a 64-character hex string (256 bits).
    Raises ValueError at startup if misconfigured — fail fast, not silently.
    """
    hex_key = Config.ENCRYPTION_KEY
    if len(hex_key) != 64:
        raise ValueError(
            "ENCRYPTION_KEY must be exactly 64 hex characters (256 bits). "
            f"Got {len(hex_key)} characters."
        )
    try:
        return bytes.fromhex(hex_key)
    except ValueError as exc:
        raise ValueError("ENCRYPTION_KEY must contain only hexadecimal characters.") from exc


def validate_encryption_key() -> None:
    """Fail fast when encryption configuration cannot protect embeddings."""
    _get_key()


def encrypt_embedding(embedding: list[float]) -> str:
    """
    Encrypt a 128-d face embedding with AES-256-GCM.

    Args:
        embedding: Plain list of 128 floats from face_recognition.

    Returns:
        Base64-encoded string: nonce (12 bytes) + ciphertext.
        This string is safe to store in the database.
    """
    values = _normalise_embedding(embedding)
    key = _get_key()
    aesgcm = AESGCM(key)

    # Serialise as compact JSON bytes
    plaintext = json.dumps(values, separators=(",", ":")).encode("utf-8")

    # Random nonce — never reuse a nonce with the same key
    nonce = os.urandom(_NONCE_BYTES)
    ciphertext = aesgcm.encrypt(nonce, plaintext, _AAD)

    # Store nonce + ciphertext together, base64 encoded
    encoded = base64.b64encode(nonce + ciphertext).decode("ascii")
    return f"{_FORMAT_PREFIX}{encoded}"


def decrypt_embedding(encrypted_value: str | Sequence[float]) -> list[float]:
    """
    Decrypt a face embedding previously encrypted by encrypt_embedding.

    Args:
        encrypted_value: Base64 string (nonce + ciphertext) from the DB.

    Returns:
        List of 128 floats.

    Raises:
        ValueError: If decryption fails (tampered data, wrong key, etc.).
    """
    # Temporary rolling-deployment compatibility for rows returned from the
    # legacy PostgreSQL FLOAT[] column. New writes are always encrypted.
    if not isinstance(encrypted_value, str):
        return _normalise_embedding(encrypted_value)

    if not encrypted_value.startswith(_FORMAT_PREFIX):
        raise ValueError("Unsupported face embedding format.")

    key = _get_key()
    aesgcm = AESGCM(key)

    try:
        raw = base64.b64decode(
            encrypted_value.removeprefix(_FORMAT_PREFIX), validate=True
        )
        if len(raw) <= _NONCE_BYTES:
            raise ValueError("Encrypted face embedding is incomplete.")
        nonce = raw[:_NONCE_BYTES]
        ciphertext = raw[_NONCE_BYTES:]
        plaintext = aesgcm.decrypt(nonce, ciphertext, _AAD)
        return _normalise_embedding(json.loads(plaintext.decode("utf-8")))
    except Exception as exc:
        # Do not log exc directly — it may contain partial key material.
        logger.error("Face embedding decryption failed", extra={"error_type": type(exc).__name__})
        raise ValueError("Failed to decrypt face embedding.") from exc

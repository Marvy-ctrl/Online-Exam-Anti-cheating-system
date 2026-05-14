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
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from src.config import Config

logger = logging.getLogger(__name__)

# GCM nonce length in bytes (96-bit is the recommended standard)
_NONCE_BYTES = 12


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
    return bytes.fromhex(hex_key)


def encrypt_embedding(embedding: list[float]) -> str:
    """
    Encrypt a 128-d face embedding with AES-256-GCM.

    Args:
        embedding: Plain list of 128 floats from face_recognition.

    Returns:
        Base64-encoded string: nonce (12 bytes) + ciphertext.
        This string is safe to store in the database.
    """
    key = _get_key()
    aesgcm = AESGCM(key)

    # Serialise as compact JSON bytes
    plaintext = json.dumps(embedding, separators=(",", ":")).encode("utf-8")

    # Random nonce — never reuse a nonce with the same key
    nonce = os.urandom(_NONCE_BYTES)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)

    # Store nonce + ciphertext together, base64 encoded
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_embedding(encrypted_value: str) -> list[float]:
    """
    Decrypt a face embedding previously encrypted by encrypt_embedding.

    Args:
        encrypted_value: Base64 string (nonce + ciphertext) from the DB.

    Returns:
        List of 128 floats.

    Raises:
        ValueError: If decryption fails (tampered data, wrong key, etc.).
    """
    key = _get_key()
    aesgcm = AESGCM(key)

    try:
        raw = base64.b64decode(encrypted_value)
        nonce = raw[:_NONCE_BYTES]
        ciphertext = raw[_NONCE_BYTES:]
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return json.loads(plaintext.decode("utf-8"))
    except Exception as exc:
        # Do not log exc directly — it may contain partial key material.
        logger.error("Face embedding decryption failed", extra={"error_type": type(exc).__name__})
        raise ValueError("Failed to decrypt face embedding.") from exc

from src.config import Config
from datetime import timedelta, datetime, timezone
from fastapi import status
from fastapi.exceptions import HTTPException
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
import jwt
import uuid
import bcrypt


ACCESS_TOKEN_EXPIRY = 3600


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(10),
    )
    return hashed.decode("utf-8")


def verify_hash_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        hashed.encode("utf-8"),
    )


def create_access_token(
    user_data: dict, expiry: timedelta = None, refresh: bool = False, role: str = "admin"
) -> str:
    payload = {}
    payload["user"] = user_data
    payload["exp"] = datetime.now(timezone.utc) + (
        expiry if expiry is not None else timedelta(seconds=ACCESS_TOKEN_EXPIRY)
    )
    payload["jti"] = str(uuid.uuid4())
    payload["refresh"] = refresh
    payload["role"] = role

    secret = Config.JWT_SECRET_EXAMINER if role == "admin" else Config.JWT_SECRET_STUDENT

    token = jwt.encode(
        payload=payload, key=secret, algorithm=Config.JWT_ALGORITHM
    )
    return token


def create_student_token(
    student_uid: str, exam_uid: str, session_uid: str, duration_minutes: int
) -> str:
    """Generate a strictly scoped JWT for a student taking an exam."""
    payload = {
        "sub": student_uid,
        "exam_uid": exam_uid,
        "session_uid": session_uid,
        "role": "student",
        "jti": str(uuid.uuid4()),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
    }
    return jwt.encode(
        payload=payload, key=Config.JWT_SECRET_STUDENT, algorithm=Config.JWT_ALGORITHM
    )


def decode_token(token: str) -> dict:
    try:
        # 1. Unverified decode to determine role and select correct secret
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        role = unverified_payload.get("role", "admin")
        
        secret = Config.JWT_SECRET_EXAMINER if role == "admin" else Config.JWT_SECRET_STUDENT

        # 2. Verified decode
        token_data = jwt.decode(
            jwt=token, key=secret, algorithms=[Config.JWT_ALGORITHM]
        )
        return token_data
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Access token has expired",
                "resolution": "Please login again to get a new token",
            },
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Invalid token",
                "resolution": "Please provide a valid access token",
            },
        )


def _get_serializer(role: str = "admin"):
    """
    Get a URLSafeTimedSerializer with the appropriate secret.
    Enrollment links are typically signed by the Admin authority.
    """
    secret = Config.JWT_SECRET_EXAMINER if role == "admin" else Config.JWT_SECRET_STUDENT
    return URLSafeTimedSerializer(secret_key=secret, salt="email-verification")


def create_url_safe_token(data: dict, role: str = "admin") -> str:
    return _get_serializer(role).dumps(data)


def decode_url_safe_token(token: str, max_age: int = ACCESS_TOKEN_EXPIRY, role: str = "admin") -> dict:
    """
    Decode a URL-safe timed token.
    Raises structured HTTP 400 errors on expiry or tampering.
    """
    try:
        return _get_serializer(role).loads(token, max_age=max_age)
    except SignatureExpired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link has expired. Please request a new one.",
        )
    except BadSignature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or tampered link. Please request a new one.",
        )

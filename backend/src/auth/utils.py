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
    user_data: dict, expiry: timedelta = None, refresh: bool = False
) -> str:
    payload = {}
    payload["user"] = user_data
    payload["exp"] = datetime.now(timezone.utc) + (
        expiry if expiry is not None else timedelta(seconds=ACCESS_TOKEN_EXPIRY)
    )
    payload["jti"] = str(uuid.uuid4())
    payload["refresh"] = refresh

    token = jwt.encode(
        payload=payload, key=Config.JWT_SECRET, algorithm=Config.JWT_ALGORITHM
    )
    return token


def decode_token(token: str) -> dict:
    try:
        token_data = jwt.decode(
            jwt=token, key=Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM]
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


# URLSafeTimedSerializer tracks token creation time so max_age can be enforced on decode.
serializer = URLSafeTimedSerializer(
    secret_key=Config.JWT_SECRET, salt="email-verification"
)


def create_url_safe_token(data: dict) -> str:
    return serializer.dumps(data)


def decode_url_safe_token(token: str, max_age: int = ACCESS_TOKEN_EXPIRY) -> dict:
    """
    Decode a URL-safe timed token.
    Raises structured HTTP 400 errors on expiry or tampering —
    never leaks a raw exception to the client.

    Args:
        token:   The URL-safe token string.
        max_age: Token validity window in seconds. Defaults to ACCESS_TOKEN_EXPIRY (1 hour).
    """
    try:
        return serializer.loads(token, max_age=max_age)
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

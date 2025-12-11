from src.config import Config
from passlib.context import CryptContext
from itsdangerous import URLSafeTimedSerializer
from datetime import timedelta, datetime, timezone
from fastapi import status
from fastapi.exceptions import HTTPException
import jwt
import uuid

ACCESS_TOKEN_EXPIRY = 3600

password_context = CryptContext(schemes=["bcrypt"])


def hash_password(password: str):
    hashed = password_context.hash(password)
    # print(hashed)
    return hashed


def verify_hash_password(password: str, hashed: str):
    return password_context.verify(password, hashed)


def create_access_token(
    user_data: dict, expiry: timedelta = None, refresh: bool = False
):

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


serializer = URLSafeTimedSerializer(
    secret_key=Config.JWT_SECRET, salt="email-verification"
)


def create_url_safe_token(data: dict):
    token = serializer.dumps(data)
    return token


def decode_url_safe_token(token: str):
    token_data = serializer.loads(token)
    return token_data

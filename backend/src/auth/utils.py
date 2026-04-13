from src.config import Config
from passlib.context import CryptContext
from itsdangerous import URLSafeTimedSerializer
from datetime import timedelta, datetime, timezone
from fastapi import status
from fastapi.exceptions import HTTPException
import jwt
import uuid
import bcrypt

ACCESS_TOKEN_EXPIRY = 3600

password_context = CryptContext(schemes=["bcrypt"])


# def hash_password(password: str) -> str:
#     encoded_password = password.encode("utf-8")
#     hashed = bcrypt.hashpw(encoded_password, bcrypt.gensalt(10))
#     # Return as a string so SQLAlchemy/asyncpg doesn't crash expecting a VARCHAR
#     return hashed.decode('utf-8')


# def verify_hash_password(password: str, hashed: str) -> bool:
#     # bcrypt.checkpw requires bytes for both arguments
#     return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))



def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(10)
    )
    return hashed.decode("utf-8")


def verify_hash_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        hashed.encode("utf-8")
    )


# def generate_passwd_hash(password: str) -> str:
#     hashed = password_context.hash(password)
#     return hashed


# def verify_password(password: str, hash: str) -> bool:
#     return password_context.verify(password, hash)



    

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

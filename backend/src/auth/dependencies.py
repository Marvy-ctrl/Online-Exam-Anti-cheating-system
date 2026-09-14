from fastapi.security import HTTPBearer
from fastapi import Request, status, Depends
from fastapi.security.http import HTTPAuthorizationCredentials
from .utils import decode_token
from fastapi.exceptions import HTTPException
from src.auth.redis import token_in_blocklist
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from src.db.models import Admin


class TokenBearer:
    def __init__(self, auto_error=True):
        self.auto_error = auto_error

    async def __call__(self, request: Request) -> dict | None:
        # 1. Try to get token from Authorization header
        auth_header = request.headers.get("Authorization")
        # print("DEBUG auth_header:", auth_header)
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        
        # 2. Try to get token from cookie
        # print("DEBUG request.cookies:", request.cookies)
        if not token:
            token = request.cookies.get("access_token")

        if not token:
            # print("DEBUG token is missing!")
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authenticated"
                )
            return None

        # decode_token raises a structured HTTPException if the token is
        # expired or invalid
        token_data = decode_token(token)

        if await token_in_blocklist(token_data["jti"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "This token is invalid or has been revoked",
                    "resolution": "Please get a new token",
                },
            )

        self.verify_token_data(token_data)
        return token_data

    def verify_token_data(self, token_data):
        raise NotImplementedError("Please override this method in child classes")


class AccessTokenBearer(TokenBearer):
    def verify_token_data(self, token_data: dict) -> None:
        if token_data and token_data["refresh"]:
            raise HTTPException(
                status_code=status.HTTP_406_NOT_ACCEPTABLE,
                detail="Please provide the access token",
            )


class RefreshTokenBearer(TokenBearer):
    def verify_token_data(self, token_data: dict) -> None:
        if token_data and not token_data["refresh"]:
            raise HTTPException(
                status_code=status.HTTP_406_NOT_ACCEPTABLE,
                detail="Please provide the refresh token",
            )

class RefreshTokenCookie:
    async def __call__(self, request: Request) -> dict:
        token = request.cookies.get("refresh_token")
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token missing from cookies"
            )

        token_data = decode_token(token)

        if await token_in_blocklist(token_data["jti"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "This token is invalid or has been revoked",
                    "resolution": "Please get a new token",
                },
            )

        if not token_data["refresh"]:
            raise HTTPException(
                status_code=status.HTTP_406_NOT_ACCEPTABLE,
                detail="Please provide the refresh token",
            )
            
        return token_data


async def get_current_user(
    token_details: dict = Depends(AccessTokenBearer()),
    session: AsyncSession = Depends(get_session),
):
    user_email = token_details["user"]["email"]
    from .service import UserService

    user_service = UserService()

    user = await user_service.get_user_by_email(user_email, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only Admins have access")
    return user


async def verify_student_session(
    request: Request,
    exam_uid: str,
    student_uid: str,
) -> dict:
    """
    Dependency to verify a student's session token.
    Reads HttpOnly cookie and validates scope and URL parameters.
    """
    token = request.cookies.get("exam_auth_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token missing or expired"
        )
        
    token_data = decode_token(token)
    
    if token_data.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token scope"
        )
        
    if token_data.get("exam_uid") != exam_uid or token_data.get("sub") != student_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token does not match the requested exam or student"
        )

    if not token_data.get("session_uid"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student token is missing its exam session scope"
        )
        
    return token_data

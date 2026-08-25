from fastapi import APIRouter, Depends, status, BackgroundTasks
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio.session import AsyncSession
from .schema import (
    UserCreateModel,
    UserLoginModel,
    UserresponseModel,
    ChangePasswordModel,
    ForgotPasswordModel,
    PasswordResetModel
)
from src.db.main import get_session
from src.auth.service import UserService
from src.config import Config
from src.dependencies.roles import Role
from .utils import (
    hash_password,
    verify_hash_password,
    create_access_token,
    create_url_safe_token,
    decode_url_safe_token,
)
from .dependencies import AccessTokenBearer, RefreshTokenBearer, RefreshTokenCookie, get_current_user
from .email import send_verification_email, send_password_reset_email
from datetime import timedelta

access_token_bearer = AccessTokenBearer()
auth_router = APIRouter()
admin_only = Role(["admin"])
user_service = UserService()
REFRESH_TOKEN_EXPIRY = 2  # days


@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
async def create_account(
    details: UserCreateModel,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
   
    email = details.email
    existing_user = await user_service.get_user_by_email(email, session)

    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        token = create_url_safe_token({"email": email})
        background_tasks.add_task(send_verification_email, email, token)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "A verification email has been sent. Please check your inbox."
            },
        )

    new_user = await user_service.create_user(details, session)
    token = create_url_safe_token({"email": email})
    background_tasks.add_task(send_verification_email, email, token)

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Account created. Please check your email to verify your account.",
            "uid": str(new_user.uid),
            "email": new_user.email,
        },
    )


@auth_router.get("/verify-email")
async def verify_email(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Verify an examiner's email address using the token sent to their inbox.
    decode_url_safe_token raises structured HTTP 400 errors on expiry or tampering.
    """
    token_data = decode_url_safe_token(token)
    email = token_data.get("email")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token.",
        )

    user = await user_service.get_user_by_email(email, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found.",
        )

    if user.is_verified:
        return JSONResponse(
            content={"message": "Email is already verified. You can log in."}
        )

    user.is_verified = True
    session.add(user)
    await session.commit()

    return JSONResponse(
        content={"message": "Email verified successfully. You can now log in."}
    )


@auth_router.get("/me")
async def get_me(user = Depends(get_current_user)):
    """
    Validate the session cookie and return the logged-in user.
    """
    return JSONResponse(content={
        "uid": str(user.uid),
        "email": user.email,
        "first_name": user.first_name,
        "role": user.role
    })

@auth_router.post("/login")
async def login(
    details: UserLoginModel,
    session: AsyncSession = Depends(get_session),
):
    email = details.email
    password = details.password

    user = await user_service.get_user_by_email(email, session)

    if user:
        if not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Credentials",
            )

        correct_password = verify_hash_password(password, user.password)
        if correct_password:
            access_token = create_access_token(
                user_data={
                    "email": user.email,
                    "uid": str(user.uid),
                    "role": user.role,
                }
            )
            refresh_token = create_access_token(
                user_data={
                    "email": user.email,
                    "uid": str(user.uid),
                    "role": user.role,
                },
                expiry=timedelta(days=REFRESH_TOKEN_EXPIRY),
                refresh=True,
            )
            response = JSONResponse(
                content={
                    "message": f"Welcome, {user.first_name}",
                    "user_details": {
                        "uid": str(user.uid),
                        "email": user.email,
                        "role": user.role,
                    },
                }
            )
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=Config.COOKIE_SECURE,
                samesite="lax",
                max_age=15*60,
                path="/"
            )
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                secure=Config.COOKIE_SECURE,
                samesite="lax",
                max_age=REFRESH_TOKEN_EXPIRY * 24 * 60 * 60,
                path="/"
            )
            return response

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Incorrect email or password.",
    )


@auth_router.post("/refresh_token")
async def refresh_token(
    token_details: dict = Depends(RefreshTokenCookie()),
):
    new_access_token = create_access_token(user_data=token_details["user"])
    response = JSONResponse(content={"message": "Token refreshed successfully"})
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=Config.COOKIE_SECURE,
        samesite="lax",
        max_age=15*60,
        path="/"
    )
    return response


@auth_router.post("/logout")
async def logout():
    """
    Clear the secure HttpOnly cookies to log the user out.
    """
    response = JSONResponse(content={"message": "Successfully logged out."})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return response


@auth_router.post("/change-password")
async def change_password(
    details: ChangePasswordModel,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """
    Change the authenticated user's password.
    """
    if details.new_password != details.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match."
        )

    correct_password = verify_hash_password(details.current_password, user.password)
    if not correct_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password."
        )

    user.password = hash_password(details.new_password)
    session.add(user)
    await session.commit()

    return JSONResponse(
        content={
            "success": True,
            "data": {"message": "Password changed successfully."},
            "error": None,
            "meta": {}
        }
    )

@auth_router.post("/forget-password")
async def forget_password(
    details: ForgotPasswordModel,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    email = details.email
    user = await user_service.get_user_by_email(email, session)
    
    if user:
        token = create_url_safe_token({"email": email})
        background_tasks.add_task(send_password_reset_email, email, token)

    return JSONResponse(
        content={
            "success": True,
            "data": {"message": "A password reset link has been sent."},
            "error": None,
            "meta": {}
        }
    )


@auth_router.post("/reset-password")
async def reset_password(
    details: PasswordResetModel,
    session: AsyncSession = Depends(get_session),
):
    if details.new_password != details.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match."
        )

    # Decode token raises HTTP 400 if expired or invalid
    token_data = decode_url_safe_token(details.token)
    email = token_data.get("email")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token."
        )

    user = await user_service.get_user_by_email(email, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found."
        )

    user.password = hash_password(details.new_password)
    session.add(user)
    await session.commit()

    return JSONResponse(
        content={
            "success": True,
            "data": {"message": "Password has been successfully reset. You can now log in."},
            "error": None,
            "meta": {}
        }
    )

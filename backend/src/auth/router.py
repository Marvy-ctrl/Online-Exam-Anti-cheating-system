from fastapi import APIRouter, Depends, status
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio.session import AsyncSession
from .schema import (
    UserCreateModel,
    UserLoginModel,
    UserresponseModel,
)
from src.db.main import get_session
from src.auth.service import UserService
from src.dependencies.roles import Role
from .utils import (
    verify_hash_password,
    create_access_token,
    create_url_safe_token,
    decode_token,
    decode_url_safe_token,
)
from .dependencies import AccessTokenBearer
from datetime import timedelta

access_token_bearer = AccessTokenBearer()
auth_router = APIRouter()
admin_only = Role(["admin"])
user_service = UserService()
REFRESH_TOKEN_EXPIRY = 2


@auth_router.post("/register", response_model=UserresponseModel)
async def create_account(
    details: UserCreateModel,
    session: AsyncSession = Depends(get_session),
    # current_user=Depends(admin_only),
):
    email = details.email

    user_exist = await user_service.user_exists(email, session)

    if user_exist:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User already exists"
        )

    new_user = await user_service.create_user(details, session)
    return new_user


@auth_router.post("/login")
async def login(details: UserLoginModel, session: AsyncSession = Depends(get_session)):
    email = details.email
    password = details.password
    user = await user_service.get_user_by_email(email, session)
    if user:
        correct_password = verify_hash_password(password, user.password)
        if correct_password:
            access_token = create_access_token(
                user_data={"email": user.email, "uid": str(user.uid), "role": user.role}
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
            return JSONResponse(
                content={
                    "message": f"Welcome, {user.first_name}",
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "user_details": {
                        "uid": str(user.uid),
                        "email": user.email,
                        "role": user.role,
                    },
                }
            )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect Details"
    )

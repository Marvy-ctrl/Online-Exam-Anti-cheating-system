from fastapi import APIRouter, Depends, status
from fastapi.exceptions import HTTPException
from sqlalchemy.ext.asyncio.session import AsyncSession
from .schema import UserCreateModel, UserLoginModel, UserresponseModel
from src.db.main import get_session
from src.auth.service import UserService
from src.dependencies.roles import Role

auth_router = APIRouter()
admin_only = Role(["admin"])
user_service = UserService()


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

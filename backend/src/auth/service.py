from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, desc
from src.db.models import Admin
from .schema import UserCreateModel
from .utils import hash_password
from src.dependencies.roles import Role

role = Role(["admin"])


class UserService:

    async def create_user(self, details: UserCreateModel, session: AsyncSession):
        user_dict = details.model_dump()
        new_user = Admin(**user_dict)
        new_user.password = hash_password(user_dict["password"])
        new_user.role = "admin"

        session.add(new_user)

        await session.commit()

        return new_user

    async def get_user_by_email(self, email: str, session: AsyncSession):
        statement = select(Admin).where(Admin.email == email)
        result = await session.exec(statement)
        user = result.first()
        return user

    async def user_exists(self, email: str, session: AsyncSession):
        user = await self.get_user_by_email(email, session)
        return True if user else False

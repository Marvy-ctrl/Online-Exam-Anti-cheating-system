from typing import List
from src.db.models import Admin
from fastapi import Request, status, Depends
from src.db.models import Admin
from src.auth.dependencies import get_current_user
from fastapi.exceptions import HTTPException


class Role:
    def __init__(self, allowed_roles: List["str"]) -> None:
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: Admin = Depends(get_current_user)):
        if not current_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Account not verified"
            )

        if current_user.role.strip() in self.allowed_roles:
            return True
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Permission not allowed"
        )

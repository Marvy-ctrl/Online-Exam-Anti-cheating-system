from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, desc
from src.db.models import Institution
from uuid import UUID
from .schema import InstitutionCreateModel

class InstitutionService:
    async def create_institution(
        self, institution_data: InstitutionCreateModel, admin_uid: str, session: AsyncSession
    ):
        institution_dict = institution_data.model_dump()
        institution_dict["admin_uid"] = UUID(admin_uid)
        
        new_institution = Institution(**institution_dict)
        session.add(new_institution)
        await session.commit()
        await session.refresh(new_institution)
        return new_institution

    async def get_all_institutions(self, session: AsyncSession, admin_uid: str):
        # Fetch only institutions owned by the logged-in admin
        statement = select(Institution).where(Institution.admin_uid == admin_uid).order_by(desc(Institution.created_at))
        result = await session.exec(statement)
        return result.all()
        
    async def get_institution(self, institution_uid: str, session: AsyncSession, admin_uid: str):
        # Enforce multi-tenant safety by ensuring it is owned by the admin
        statement = select(Institution).where(
            Institution.uid == institution_uid, 
            Institution.admin_uid == admin_uid
        )
        result = await session.exec(statement)
        return result.first()

    async def delete_institution(self, institution_uid: str, session: AsyncSession, admin_uid: str) -> bool:
        """Deletes an institution if it exists and is owned by the admin."""
        institution = await self.get_institution(institution_uid, session, admin_uid)
        if not institution:
            return False
        
        await session.delete(institution)
        await session.commit()
        return True

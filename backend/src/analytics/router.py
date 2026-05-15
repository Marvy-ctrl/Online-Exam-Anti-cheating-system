from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from src.auth.dependencies import AccessTokenBearer
from src.dependencies.roles import Role
from .service import AnalyticsService
from .schema import AnalyticsDashboardResponse

analytics_router = APIRouter()
analytics_service = AnalyticsService()
access_token_bearer = AccessTokenBearer()
role = Role(["admin"])

@analytics_router.get("/dashboard", response_model=AnalyticsDashboardResponse)
async def get_analytics_dashboard(
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = str(token_details.get("user")["uid"])
    analytics_data = await analytics_service.get_analytics_dashboard(session, admin_uid)
    return analytics_data


@analytics_router.get("/institution/{institution_uid}")
async def get_institution_analytics(
    institution_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    # Note: In a production app, we'd verify the admin owns this institution
    analytics_data = await analytics_service.get_institution_analytics(session, institution_uid)
    return analytics_data

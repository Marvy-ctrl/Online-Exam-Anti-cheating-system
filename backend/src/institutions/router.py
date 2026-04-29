from fastapi import APIRouter, Depends, status, UploadFile, File
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from src.auth.dependencies import AccessTokenBearer
from src.dependencies.roles import Role
from .service import InstitutionService
from .schema import InstitutionCreateModel, InstitutionResponseModel
from src.config import Config
import cloudinary
import cloudinary.uploader
import asyncio

institution_router = APIRouter()
institution_service = InstitutionService()
access_token_bearer = AccessTokenBearer()
role = Role(["admin"])

cloudinary.config(
    cloud_name=Config.CLOUDINARY_CLOUD_NAME,
    api_key=Config.CLOUDINARY_API_KEY,
    api_secret=Config.CLOUDINARY_API_SECRET,
    secure=True,
)

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}
MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB


@institution_router.post("/create", response_model=InstitutionResponseModel)
async def create_institution(
    institution_data: InstitutionCreateModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = str(token_details.get("user")["uid"])
    new_inst = await institution_service.create_institution(institution_data, admin_uid, session)
    return new_inst


@institution_router.get("/", response_model=list[InstitutionResponseModel])
async def get_my_institutions(
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = str(token_details.get("user")["uid"])
    institutions = await institution_service.get_all_institutions(session, admin_uid)
    return institutions


@institution_router.get("/{institution_uid}", response_model=InstitutionResponseModel)
async def get_institution(
    institution_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    admin_uid = str(token_details.get("user")["uid"])
    institution = await institution_service.get_institution(institution_uid, session, admin_uid)
    if not institution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found or unauthorized")
    return institution


@institution_router.delete("/{institution_uid}")
async def delete_institution(
    institution_uid: str,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    """Delete an institution and all associated data."""
    admin_uid = str(token_details.get("user")["uid"])
    success = await institution_service.delete_institution(institution_uid, session, admin_uid)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Institution not found or unauthorized"
        )
    return {"success": True, "message": "Institution deleted successfully"}


@institution_router.post("/upload-logo")
async def upload_institution_logo(
    file: UploadFile = File(...),
    token_details: dict = Depends(access_token_bearer),
    admin_only=Depends(role),
):
    
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: JPEG, PNG, WebP, SVG.",
        )

    # Check size by seeking to end
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_LOGO_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Logo file must be 2 MB or smaller.",
        )

    try:
        # Cloudinary SDK is synchronous — run in a thread pool to avoid blocking the event loop
        # Pass file.file instead of contents to avoid byte-string errors
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            file.file,
            folder="institution_logos",
            resource_type="image",
            overwrite=False,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cloudinary upload failed: {str(e)}",
        )

    return JSONResponse(content={"logo_url": result["secure_url"]})
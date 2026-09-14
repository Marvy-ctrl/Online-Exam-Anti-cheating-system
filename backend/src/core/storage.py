import os
import uuid
import base64
import logging
from typing import Dict, Any, Optional
from minio.error import S3Error
from minio.lifecycleconfig import LifecycleConfig, Rule, Expiration
from minio.commonconfig import Filter
from src.config import Config
from minio import Minio
import io


logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.minio_client = None
        self.minio_available = False
        self.bucket_name = Config.MINIO_BUCKET

        try:
            # Attempt to initialize the MinIO client
            self.minio_client = Minio(
                endpoint=Config.MINIO_ENDPOINT,
                access_key=Config.MINIO_ACCESS_KEY,
                secret_key=Config.MINIO_SECRET_KEY,
                secure=Config.MINIO_SECURE,
            )
            self.minio_available = True
            logger.info("MinIO storage client initialized successfully.")
        except ImportError:
            logger.warning("minio package not installed. Local filesystem storage fallback will be used.")
        except Exception as e:
            logger.warning(f"Failed to initialize MinIO storage client: {e}. Fallback to local storage.")

    def _ensure_bucket(self) -> bool:
        """Helper to ensure MinIO bucket exists. Returns True if bucket exists and is ready."""
        if not self.minio_available or not self.minio_client:
            return False
        try:
            if not self.minio_client.bucket_exists(self.bucket_name):
                self.minio_client.make_bucket(self.bucket_name)
                logger.info(f"Created MinIO bucket: {self.bucket_name}")
            
            # MinIO expiry is a second layer of protection. The evidence cleanup
            # task also removes expired database rows and local fallback files.
            config = LifecycleConfig([
                Rule(
                    status="Enabled",
                    rule_filter=Filter(prefix=""),
                    rule_id="expire-snapshots",
                    expiration=Expiration(days=Config.SNAPSHOT_RETENTION_DAYS)
                )
            ])
            self.minio_client.set_bucket_lifecycle(self.bucket_name, config)
            return True
        except Exception as e:
            logger.warning(f"MinIO bucket check failed (MinIO might be offline): {e}")
            return False

    def upload_snapshot(
        self,
        session_uid: str,
        snapshot_uid: uuid.UUID,
        base64_image: str,
    ) -> Dict[str, Any]:
        """
        Uploads a base64 encoded snapshot frame.
        First attempts to upload to MinIO. If MinIO is offline or unavailable,
        it gracefully falls back to local filesystem storage.
        
        Returns:
            dict containing:
                "image_path": str (storage location retained for compatibility)
                "object_key": Optional[str] (MinIO object key, if uploaded to MinIO)
        """

        # 1. Clean the base64 image data (remove prefixes like data:image/jpeg;base64,)
        if "," in base64_image:
            image_data_str = base64_image.split(",")[1]
        else:
            image_data_str = base64_image

        try:
            image_bytes = base64.b64decode(image_data_str)
        except Exception as e:
            logger.error(f"Failed to decode base64 image data: {e}")
            raise ValueError(f"Invalid base64 image: {e}")

        # 2. Define object/file name
        filename = f"{session_uid}/{snapshot_uid}.jpg"

        # 3. Attempt MinIO upload
        if self.minio_available and self.minio_client:
            try:
                if self._ensure_bucket():
                    data_stream = io.BytesIO(image_bytes)
                    self.minio_client.put_object(
                        bucket_name=self.bucket_name,
                        object_name=filename,
                        data=data_stream,
                        length=len(image_bytes),
                        content_type="image/jpeg",
                    )
                    logger.info(f"Successfully uploaded snapshot {snapshot_uid} to MinIO bucket {self.bucket_name}")
                    return {
                        "image_path": filename,
                        "object_key": filename,
                    }
            except Exception as e:
                logger.warning(f"MinIO upload failed: {e}. Falling back to local filesystem storage.")

        # 4. Fallback: Save to local filesystem
        # Snapshots are stored under root uploads/snapshots/
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
        uploads_dir = os.path.join(backend_dir, "uploads")
        local_dir = os.path.join(uploads_dir, "snapshots", session_uid)
        os.makedirs(local_dir, exist_ok=True)
        local_filepath = os.path.join(local_dir, f"{snapshot_uid}.jpg")
        
        try:
            with open(local_filepath, "wb") as f:
                f.write(image_bytes)
            logger.info(f"Successfully saved snapshot {snapshot_uid} to local filesystem fallback.")
            
            # This legacy path is stored for compatibility. Snapshot reads go
            # through the authenticated exam-session endpoint, never /static.
            static_url = f"/static/snapshots/{session_uid}/{snapshot_uid}.jpg"
            return {
                "image_path": static_url,
                "object_key": None,
            }
        except Exception as e:
            logger.error(f"Local storage fallback failed: {e}")
            # Never persist biometric image data inline in the database. The
            # caller can still record the violation without retaining a frame.
            raise RuntimeError("Snapshot storage is unavailable") from e

    def delete_snapshot(
        self,
        session_uid: str,
        snapshot_uid: uuid.UUID,
        object_key: Optional[str] = None,
        image_path: Optional[str] = None,
    ) -> bool:
        """Delete one retained snapshot from MinIO or local fallback storage.

        Missing files are treated as already deleted. A temporary MinIO or
        filesystem failure returns False so the cleanup task keeps the database
        row and can retry later.
        """
        if object_key:
            if not self.minio_available or not self.minio_client:
                return False
            try:
                self.minio_client.remove_object(self.bucket_name, object_key)
                return True
            except S3Error as exc:
                if exc.code in {"NoSuchKey", "NoSuchObject"}:
                    return True
                logger.warning(
                    "Failed to delete MinIO snapshot",
                    extra={"snapshot_uid": str(snapshot_uid), "error": exc.code},
                )
                return False
            except Exception as exc:
                logger.warning(
                    "Failed to delete MinIO snapshot",
                    extra={
                        "snapshot_uid": str(snapshot_uid),
                        "error": type(exc).__name__,
                    },
                )
                return False

        # Legacy inline values contain no external object. Removing their
        # database row is sufficient to erase the retained image.
        if image_path and image_path.startswith("data:image/"):
            return True

        backend_dir = os.path.abspath(
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
        )
        snapshots_root = os.path.realpath(
            os.path.join(backend_dir, "uploads", "snapshots")
        )
        local_path = os.path.realpath(
            os.path.join(snapshots_root, str(session_uid), f"{snapshot_uid}.jpg")
        )
        if os.path.commonpath([snapshots_root, local_path]) != snapshots_root:
            logger.error("Refusing to delete snapshot outside storage root")
            return False

        try:
            if os.path.exists(local_path):
                os.remove(local_path)
            parent_dir = os.path.dirname(local_path)
            if os.path.isdir(parent_dir) and not os.listdir(parent_dir):
                os.rmdir(parent_dir)
            return True
        except OSError as exc:
            logger.warning(
                "Failed to delete local snapshot",
                extra={
                    "snapshot_uid": str(snapshot_uid),
                    "error": type(exc).__name__,
                },
            )
            return False

    def generate_presigned_url(self, object_key: str) -> str:
        """
        Returns a proxied API URL instead of a direct MinIO presigned URL.
        This completely bypasses AWS Signature 'Host' header mismatch issues
        when the browser accesses localhost but MinIO expects the 'minio' hostname.
        """
        if not self.minio_available or not self.minio_client or not object_key:
            return object_key

        return f"{Config.DOMAIN}/api/v1/exam_session/storage/snapshot/{object_key}"

storage_service = StorageService()

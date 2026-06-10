import os
import uuid
import base64
import logging
from datetime import timedelta
from typing import Dict, Any, Optional
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
                "image_path": str (static relative URL or fallback path)
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
            
            # The static URL will be accessible via FastAPI mounted StaticFiles at /static/snapshots/
            # Static route resolves "uploads" to "/static", so uploads/snapshots/{session_uid}/{snapshot_uid}.jpg
            # becomes /static/snapshots/{session_uid}/{snapshot_uid}.jpg
            static_url = f"/static/snapshots/{session_uid}/{snapshot_uid}.jpg"
            return {
                "image_path": static_url,
                "object_key": None,
            }
        except Exception as e:
            logger.error(f"Local storage fallback failed: {e}")
            # As a final absolute fallback, return a raw inline base64 placeholder so we never crash the session
            return {
                "image_path": f"data:image/jpeg;base64,{image_data_str}",
                "object_key": None,
            }

    def generate_presigned_url(self, object_key: str) -> str:
        """
        Generates a 15-minute secure presigned URL for an examiner to retrieve the snapshot from MinIO.
        If MinIO is disabled or fails, returns a fallback static URL or the object key directly.
        """
        if not self.minio_available or not self.minio_client or not object_key:
            return object_key

        try:
            url = self.minio_client.presigned_get_object(
                bucket_name=self.bucket_name,
                object_name=object_key,
                expires=timedelta(minutes=15),
            )
            # Allow browser to resolve localhost instead of the docker-internal 'minio' hostname
            if "minio:9000" in url and "localhost" in Config.DOMAIN:
                url = url.replace("minio:9000", "localhost:9000")
            return url
        except Exception as e:
            logger.warning(f"Failed to generate MinIO presigned URL: {e}")
            return f"/static/snapshots/{object_key}"

storage_service = StorageService()

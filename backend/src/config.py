import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_EXAMINER: str
    JWT_SECRET_STUDENT: str
    JWT_ALGORITHM: str
    REDIS_URL: str
    DOMAIN: str
    FRONTEND_URL: str

    # MinIO / S3 Configuration
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET: str
    MINIO_SECURE: bool = False

    # Celery Configuration
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    DB_SSL: bool = False
    SMTP_HOST: str
    SMTP_PORT: int = 465
    SMTP_USER: str
    SMTP_PASSWORD: str
    SMTP_FROM: str
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str
    # Face verification — Euclidean distance threshold.
    # Lower = stricter. 0.40 is high-security. Read from env, never hardcoded.
    FACE_SIMILARITY_THRESHOLD: float = 0.40
    FACE_ENROLLMENT_MIN_PASSING: int = 3
    # AES-256-GCM encryption key for biometric data at rest.
    # Must be exactly 64 hex characters (32 bytes = 256 bits).
    # Generate with: python -c "import secrets; print(secrets.token_hex(32))"
    ENCRYPTION_KEY: str

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"), 
        extra="forbid"
    )



Config = Settings()

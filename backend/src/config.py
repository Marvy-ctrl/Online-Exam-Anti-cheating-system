from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str
    REDIS_URL: str
    DOMAIN: str
    model_config = SettingsConfigDict(env_file="backend/src/.env", extra="ignore")


Config = Settings()

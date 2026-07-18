from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    KAFKA_BOOTSTRAP_SERVERS: str
    DISCORD_CLIENT_ID: str
    DISCORD_CLIENT_SECRET: str
    DISCORD_BOT_TOKEN: str
    DISCORD_REDIRECT_URI: str = "http://localhost/api/v1/auth/discord/callback"
    SECRET_KEY: str
    DEBUG: bool = False

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
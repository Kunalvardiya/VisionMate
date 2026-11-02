from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Override with VISIONMATE_* env vars or a .env file."""

    model_config = SettingsConfigDict(env_prefix="VISIONMATE_", env_file=".env", extra="ignore")

    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    allowed_hosts: list[str] = ["localhost", "127.0.0.1"]

    max_frame_bytes: int = 2_000_000
    max_frame_side: int = 4096

    frame_max_width: int = 640
    frame_jpeg_quality: float = 0.7
    frame_max_fps: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()

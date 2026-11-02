from fastapi import FastAPI

from app.api import health
from app.config import Settings, get_settings
from app.core.security import GuardMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="VisionMate", docs_url=None, redoc_url=None)
    app.add_middleware(
        GuardMiddleware,
        allowed_origins=settings.allowed_origins,
        allowed_hosts=settings.allowed_hosts,
    )
    app.include_router(health.router)
    return app

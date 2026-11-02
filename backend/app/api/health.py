from fastapi import APIRouter

router = APIRouter(prefix="/api")

VERSION = "0.1.0"


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": VERSION}

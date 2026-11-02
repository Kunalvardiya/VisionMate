import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.config import Settings
from app.services.frames.decoder import FrameError, decode_jpeg

router = APIRouter(prefix="/api/frames")


class FrameInfo(BaseModel):
    width: int
    height: int
    bytes: int
    decode_ms: float


class FrameSampling(BaseModel):
    max_width: int
    jpeg_quality: float
    max_fps: int


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


@router.get("/sampling")
def sampling(request: Request) -> FrameSampling:
    s = _settings(request)
    return FrameSampling(
        max_width=s.frame_max_width, jpeg_quality=s.frame_jpeg_quality, max_fps=s.frame_max_fps
    )


@router.post("/inspect", response_model=FrameInfo)
async def inspect(request: Request) -> FrameInfo | JSONResponse:
    settings = _settings(request)
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type != "image/jpeg":
        return JSONResponse({"detail": "Content-Type must be image/jpeg"}, status_code=415)

    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > settings.max_frame_bytes:
            return JSONResponse({"detail": "Frame too large"}, status_code=413)
        chunks.append(chunk)
    data = b"".join(chunks)

    started = time.perf_counter()
    try:
        frame = await run_in_threadpool(decode_jpeg, data, settings.max_frame_side)
    except FrameError as error:
        return JSONResponse({"detail": error.message}, status_code=error.status)
    decode_ms = (time.perf_counter() - started) * 1000
    return FrameInfo(width=frame.width, height=frame.height, bytes=len(data), decode_ms=decode_ms)

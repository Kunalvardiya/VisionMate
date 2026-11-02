import threading

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

HEADERS = {"Origin": "http://localhost:5173", "Content-Type": "image/jpeg"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(), base_url="http://localhost:8000")


def make_jpeg(width: int = 320, height: int = 240) -> bytes:
    rng = np.random.default_rng(0)
    image = rng.integers(0, 255, size=(height, width, 3), dtype=np.uint8)
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    return buffer.tobytes()


def post(client: TestClient, body: bytes, headers: dict[str, str] | None = None):
    return client.post("/api/frames/inspect", content=body, headers=headers or HEADERS)


def test_valid_jpeg_returns_dimensions(client: TestClient) -> None:
    data = make_jpeg(320, 240)
    response = post(client, data)
    assert response.status_code == 200
    body = response.json()
    assert (body["width"], body["height"]) == (320, 240)
    assert body["bytes"] == len(data)
    assert body["decode_ms"] >= 0


def test_empty_body_400(client: TestClient) -> None:
    assert post(client, b"").status_code == 400


def test_truncated_jpeg_400(client: TestClient) -> None:
    data = make_jpeg()
    assert post(client, data[: len(data) // 2]).status_code == 400


def test_random_bytes_400(client: TestClient) -> None:
    assert post(client, bytes(range(256)) * 20).status_code == 400


def test_png_bytes_labeled_jpeg_400(client: TestClient) -> None:
    ok, png = cv2.imencode(".png", np.zeros((10, 10, 3), dtype=np.uint8))
    assert ok
    assert post(client, png.tobytes()).status_code == 400


@pytest.mark.parametrize("content_type", ["image/png", "text/plain"])
def test_wrong_content_type_415(client: TestClient, content_type: str) -> None:
    headers = {**HEADERS, "Content-Type": content_type}
    assert post(client, make_jpeg(), headers).status_code == 415


def test_oversized_body_413(client: TestClient) -> None:
    assert post(client, make_jpeg() + b"\0" * 2_100_000).status_code == 413


def test_declared_huge_dimensions_413_without_decoding(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    data = bytearray(make_jpeg(16, 16))
    sof = data.index(b"\xff\xc0")  # baseline SOF0: marker, length(2), precision(1), h(2), w(2)
    data[sof + 5 : sof + 9] = (30000).to_bytes(2, "big") * 2

    def boom(*args: object, **kwargs: object) -> None:
        raise AssertionError("imdecode must not run for oversized declared dimensions")

    monkeypatch.setattr(cv2, "imdecode", boom)
    assert post(client, bytes(data)).status_code == 413


def test_sampling_defaults(client: TestClient) -> None:
    response = client.get("/api/frames/sampling")
    assert response.status_code == 200
    assert response.json() == {"max_width": 640, "jpeg_quality": 0.7, "max_fps": 5}


def test_foreign_origin_blocked_on_inspect(client: TestClient) -> None:
    headers = {**HEADERS, "Origin": "https://evil.example"}
    assert post(client, make_jpeg(), headers).status_code == 403


def build_desync_attack(prefix_marker: bytes, real_side: int = 8000) -> bytes:
    """A JPEG whose real SOF declares real_side² but whose naive length-skipping parse lands on a fake 16x16 SOF.

    Markers TEM (FF01), RSTn (FFD0-D7) and a stuffed FF00 carry no length field; a parser that
    assumes every marker has one jumps to the wrong place while libjpeg decodes the real header.
    """
    good = make_jpeg(16, 16)
    sof_at = good.index(b"\xff\xc0")
    seg_len = int.from_bytes(good[sof_at + 2 : sof_at + 4], "big")
    sof = good[sof_at : sof_at + 2 + seg_len]

    def with_dims(segment: bytes, side: int) -> bytes:
        return segment[:5] + side.to_bytes(2, "big") * 2 + segment[9:]

    rest = good[2:sof_at] + good[sof_at + 2 + seg_len :]
    prefix = b"\xff\xd8" + prefix_marker + with_dims(sof, real_side)
    skip_to = 2 + 2 + 0xFFC0  # where a length-assuming parser lands after reading FF C0 as a length
    padding = skip_to - (len(prefix) + 4)
    comment_body = b"\x00" * padding + with_dims(sof, 16) + b"\x00" * 8
    comment = b"\xff\xfe" + (len(comment_body) + 2).to_bytes(2, "big") + comment_body
    return prefix + comment + rest


@pytest.mark.parametrize("marker", [b"\xff\x01", b"\xff\xd0", b"\xff\x00"], ids=["TEM", "RST0", "FF00"])
def test_length_less_marker_cannot_hide_real_dimensions(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, marker: bytes
) -> None:
    def boom(*args: object, **kwargs: object) -> None:
        raise AssertionError("imdecode must not run on a JPEG with an unparseable header")

    monkeypatch.setattr(cv2, "imdecode", boom)
    attack = build_desync_attack(marker)
    assert len(attack) < 2_000_000
    assert post(client, attack).status_code == 400


def test_routes_honor_settings_passed_to_create_app() -> None:
    small = TestClient(create_app(Settings(max_frame_bytes=100)), base_url="http://localhost:8000")
    assert post(small, make_jpeg(64, 64)).status_code == 413
    narrow = TestClient(create_app(Settings(frame_max_width=320)), base_url="http://localhost:8000")
    assert narrow.get("/api/frames/sampling").json()["max_width"] == 320


def test_decoding_runs_off_the_event_loop_thread(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api import frames as frames_api

    app = create_app()
    loop_threads: list[int] = []
    decode_threads: list[int] = []
    real_decode = frames_api.decode_jpeg

    @app.get("/_loop_thread")
    async def loop_thread() -> dict[str, int]:
        loop_threads.append(threading.get_ident())
        return {}

    def spy(data: bytes, max_side: int):
        decode_threads.append(threading.get_ident())
        return real_decode(data, max_side)

    monkeypatch.setattr(frames_api, "decode_jpeg", spy)
    # The context manager keeps a single event-loop thread for every request.
    with TestClient(app, base_url="http://localhost:8000") as client:
        client.get("/_loop_thread")
        assert post(client, make_jpeg()).status_code == 200
    assert decode_threads and loop_threads
    assert decode_threads[0] != loop_threads[0]

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

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

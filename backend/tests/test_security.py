from fastapi.testclient import TestClient

from app.main import create_app

ALLOWED = "http://localhost:5173"


def make_client() -> TestClient:
    return TestClient(create_app(), base_url="http://localhost:8000")


def test_allowed_origin_passes() -> None:
    assert make_client().get("/api/health", headers={"Origin": ALLOWED}).status_code == 200


def test_foreign_origin_rejected() -> None:
    response = make_client().get("/api/health", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


def test_no_origin_passes_for_get() -> None:
    assert make_client().get("/api/health").status_code == 200


def test_post_without_origin_rejected() -> None:
    assert make_client().post("/api/health").status_code == 403


def test_post_with_allowed_origin_reaches_route() -> None:
    # /api/health has no POST handler, so the guard passed and routing says 405.
    response = make_client().post("/api/health", headers={"Origin": ALLOWED})
    assert response.status_code == 405


def test_bad_host_rejected() -> None:
    client = TestClient(create_app(), base_url="http://attacker.example")
    assert client.get("/api/health").status_code == 403


def test_loopback_host_with_port_passes() -> None:
    client = TestClient(create_app(), base_url="http://127.0.0.1:8000")
    assert client.get("/api/health").status_code == 200

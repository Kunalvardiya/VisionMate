from fastapi.testclient import TestClient

from app.main import create_app


def test_health_ok() -> None:
    client = TestClient(create_app(), base_url="http://localhost:8000")
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert isinstance(body["version"], str)

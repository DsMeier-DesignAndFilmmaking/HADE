import uuid
from datetime import datetime
from typing import Any

import pytest
from httpx import AsyncClient

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.main import app


class FakeAsyncSession:
    """Minimal async session stub for signal endpoint tests."""

    def __init__(self) -> None:
        self.added: list[Any] = []

    async def get(self, _model: Any, _pk: Any) -> None:
        # No persisted venues in this test path.
        return None

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        return None

    async def refresh(self, _obj: Any) -> None:
        return None


@pytest.mark.asyncio
async def test_emit_signal_returns_201(client: AsyncClient) -> None:
    fake_db = FakeAsyncSession()
    fake_user_id = uuid.uuid4()

    async def override_get_db():
        yield fake_db

    async def override_get_current_user_id() -> uuid.UUID:
        return fake_user_id

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = override_get_current_user_id

    try:
        response = await client.post(
            "/api/v1/signals",
            json={
                "geo": {"lat": 39.7392, "lng": -104.9903},
                "vibe": "fire",
                "content": "Packed and loud",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    body = response.json()

    assert body["status"] == "ok"
    assert body["data"]["type"] == "PRESENCE"
    assert body["data"]["strength"] == 1.0
    assert body["data"]["content"] == "Packed and loud"
    assert body["data"]["geo"] == {"lat": 39.7392, "lng": -104.9903}
    assert len(fake_db.added) == 1

    emitted_at = datetime.fromisoformat(body["data"]["emitted_at"].replace("Z", "+00:00"))
    expires_at = datetime.fromisoformat(body["data"]["expires_at"].replace("Z", "+00:00"))
    assert expires_at > emitted_at

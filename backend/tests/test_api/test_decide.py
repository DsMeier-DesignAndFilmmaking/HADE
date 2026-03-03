import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_decide_requires_auth(client: AsyncClient) -> None:
    """POST /api/v1/decide should return 403 without auth."""
    response = await client.post("/api/v1/decide", json={
        "geo": {"lat": 40.7128, "lng": -74.0060},
    })
    assert response.status_code == 403

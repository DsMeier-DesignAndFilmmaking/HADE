import pytest


@pytest.mark.asyncio
async def test_confidence_floor_returns_empty() -> None:
    """Scoring should return empty list when no signal meets confidence threshold."""
    # TODO: Test with weak signals below floor
    pass


@pytest.mark.asyncio
async def test_trust_signals_multiply() -> None:
    """Trust signals should multiply scores, not add."""
    # TODO: Verify multiplicative scoring behavior
    pass

"""Layer 2: Signal Aggregator — ingests and normalizes spatial+temporal signals."""

import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from geoalchemy2 import functions as geo_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.context_state import ContextState
from app.models.signal import Signal
from app.services.trust import (
    PURGE_SIGNAL_CUTOFF_HOURS,
    compute_cliff_edge_decay,
    freshness_multiplier,
)

_POINT_WKT_REGEX = re.compile(
    r"POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class AggregatedSignal:
    signal: Signal
    lat: float | None
    lng: float | None
    age_hours: float
    decay_strength: float
    freshness_multiplier: float
    effective_strength: float


def _age_in_hours(signal: Signal, now: datetime) -> float:
    return max(0.0, (now - signal.emitted_at).total_seconds() / 3600.0)


def _parse_wkt_point(geo_wkt: str | None) -> tuple[float | None, float | None]:
    if not geo_wkt:
        return (None, None)

    match = _POINT_WKT_REGEX.search(geo_wkt)
    if not match:
        return (None, None)

    lng = float(match.group(1))
    lat = float(match.group(2))
    return (lat, lng)


async def aggregate_signals(
    context: ContextState,
    user_id: UUID,
    db: AsyncSession,
    lat: float | None = None,
    lng: float | None = None,
    radius_m: int = 1500,
) -> list[AggregatedSignal]:
    """Fetch and normalize signals within context radius.

    Venue binding is handled downstream by the scoring layer:
    - direct match by venue_id
    - floating signal fallback by <= 50m proximity

    Freshness treatment:
    - <= 45m old: 1.3x multiplier
    - > 4h old: cliff-edge clamp to < 0.2 strength
    - > 12h old: excluded in SQL and never enters CandidateSet

    Returns AggregatedSignal sorted by effective strength (strongest first).

    Args:
        context: The ContextState for this decision request.
        user_id: The requesting user's ID.
        db: Async database session.
        lat: Latitude (pass from original request to avoid PostGIS extraction).
        lng: Longitude (pass from original request to avoid PostGIS extraction).
        radius_m: Search radius in meters (default 1500).

    Cold start: returns empty list if no signals exist nearby — this is expected
    and the scoring layer handles it gracefully using Google Places data alone.
    """
    _ = user_id
    now = datetime.now(UTC)
    purge_cutoff = now - timedelta(hours=PURGE_SIGNAL_CUTOFF_HOURS)

    # Build the reference point for spatial query
    if lat is not None and lng is not None:
        ref_point = f"SRID=4326;POINT({lng} {lat})"
    else:
        # Fallback: use context.geo directly (works if still WKT string from flush)
        ref_point = context.geo

    # PostGIS spatial query: limit transfer by purging stale signals in SQL.
    result = await db.execute(
        select(
            Signal,
            geo_func.ST_AsText(Signal.geo).label("geo_wkt"),
        ).where(
            geo_func.ST_DWithin(
                Signal.geo,
                geo_func.ST_GeogFromText(ref_point),
                radius_m,
            ),
            Signal.expires_at > now,
            Signal.emitted_at >= purge_cutoff,
        )
    )
    rows = result.all()

    aggregated: list[AggregatedSignal] = []
    for row in rows:
        signal: Signal = row[0]
        geo_wkt: str | None = row[1]

        age_hours = _age_in_hours(signal, now)
        if age_hours > PURGE_SIGNAL_CUTOFF_HOURS:
            continue

        decay_strength = compute_cliff_edge_decay(signal, now)
        freshness_mult = freshness_multiplier(age_hours)
        effective_strength = decay_strength * freshness_mult
        if effective_strength <= 0.01:
            continue

        lat_val, lng_val = _parse_wkt_point(geo_wkt)
        aggregated.append(
            AggregatedSignal(
                signal=signal,
                lat=lat_val,
                lng=lng_val,
                age_hours=age_hours,
                decay_strength=decay_strength,
                freshness_multiplier=freshness_mult,
                effective_strength=effective_strength,
            )
        )

    aggregated.sort(key=lambda item: item.effective_strength, reverse=True)
    return aggregated

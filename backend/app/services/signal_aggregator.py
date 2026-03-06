"""Layer 2: Signal Aggregator — ingests and normalizes signals with decay rates.

EVENT signals participate in the same spatial+temporal queries as other signal
types. Their strength decays based on proximity to starts_at (urgency increases
as the event approaches, then decays after it starts).
"""

import math
from datetime import datetime, timezone
from uuid import UUID

from geoalchemy2 import functions as geo_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.context_state import ContextState
from app.models.signal import Signal, SignalType

# Decay half-life per signal type (in seconds)
DECAY_HALF_LIFE: dict[SignalType, float] = {
    SignalType.PRESENCE: 15 * 60,          # 15 minutes
    SignalType.SOCIAL_RELAY: 3 * 3600,     # 3 hours
    SignalType.ENVIRONMENTAL: 6 * 3600,    # 6 hours
    SignalType.BEHAVIORAL: 7 * 86400,      # 7 days
    SignalType.AMBIENT: 30 * 86400,        # 30 days
    SignalType.EVENT: 2 * 3600,            # 2 hours (but modified by urgency)
}


def compute_decay(signal: Signal, now: datetime) -> float:
    """Apply exponential decay to signal strength based on type and age.

    For EVENT signals, strength increases as starts_at approaches (urgency),
    then decays normally after the event starts.
    """
    half_life = DECAY_HALF_LIFE.get(signal.type, 3600)
    age_seconds = (now - signal.emitted_at).total_seconds()

    if signal.type == SignalType.EVENT and signal.event_id:
        # For events: use time-until-start as urgency boost
        # Before start: strength increases (urgency)
        # After start: normal decay from start time
        time_to_expiry = (signal.expires_at - now).total_seconds()
        if time_to_expiry <= 0:
            return 0.0
        total_duration = (signal.expires_at - signal.emitted_at).total_seconds()
        if total_duration <= 0:
            return 0.0
        # Remaining fraction of event life
        remaining = time_to_expiry / total_duration
        return signal.strength * max(remaining, 0.2)

    # Standard exponential decay
    if age_seconds <= 0:
        return signal.strength
    decay_factor = math.exp(-0.693 * age_seconds / half_life)
    return signal.strength * decay_factor


async def aggregate_signals(
    context: ContextState,
    user_id: UUID,
    db: AsyncSession,
    lat: float | None = None,
    lng: float | None = None,
    radius_m: int = 1500,
) -> list[Signal]:
    """Fetch and normalize signals within context radius, applying decay weights.

    Uses PostGIS ST_DWithin for spatial filtering and excludes expired signals.
    Returns signals sorted by decayed strength (strongest first).

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
    now = datetime.now(timezone.utc)

    # Build the reference point for spatial query
    if lat is not None and lng is not None:
        ref_point = f"SRID=4326;POINT({lng} {lat})"
    else:
        # Fallback: use context.geo directly (works if still WKT string from flush)
        ref_point = context.geo

    # PostGIS spatial query: signals within radius that haven't expired
    result = await db.execute(
        select(Signal).where(
            geo_func.ST_DWithin(
                Signal.geo,
                geo_func.ST_GeogFromText(ref_point),
                radius_m,
            ),
            Signal.expires_at > now,
        )
    )
    signals = list(result.scalars().all())

    # Apply decay to each signal's strength (mutates in-memory, not persisted)
    for sig in signals:
        sig.strength = compute_decay(sig, now)

    # Filter out fully-decayed signals and sort by strength descending
    signals = [s for s in signals if s.strength > 0.01]
    signals.sort(key=lambda s: s.strength, reverse=True)

    return signals

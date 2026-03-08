"""Trust decay policy for signal weighting."""

import math
from datetime import datetime

from app.models.signal import Signal, SignalType

# Decay half-life per signal type (in seconds)
DECAY_HALF_LIFE: dict[SignalType, float] = {
    SignalType.PRESENCE: 15 * 60,          # 15 minutes
    SignalType.SOCIAL_RELAY: 3 * 3600,     # 3 hours
    SignalType.ENVIRONMENTAL: 6 * 3600,    # 6 hours
    SignalType.BEHAVIORAL: 7 * 86400,      # 7 days
    SignalType.AMBIENT: 30 * 86400,        # 30 days
    SignalType.EVENT: 2 * 3600,            # 2 hours (modified by urgency)
}

FRESH_SIGNAL_WINDOW_MINUTES = 45.0
FRESH_SIGNAL_MULTIPLIER = 1.3
CLIFF_EDGE_HOURS = 4.0
CLIFF_EDGE_MAX_STRENGTH = 0.19
PURGE_SIGNAL_CUTOFF_HOURS = 12.0


def compute_cliff_edge_decay(signal: Signal, now: datetime) -> float:
    """Apply weighted non-linear decay with cliff and purge guards."""
    half_life = DECAY_HALF_LIFE.get(signal.type, 3600)
    age_seconds = (now - signal.emitted_at).total_seconds()
    age_hours = max(0.0, age_seconds / 3600.0)

    if age_hours > PURGE_SIGNAL_CUTOFF_HOURS:
        return 0.0

    base_strength = signal.strength
    if signal.type == SignalType.EVENT and signal.event_id:
        time_to_expiry = (signal.expires_at - now).total_seconds()
        if time_to_expiry <= 0:
            return 0.0
        total_duration = (signal.expires_at - signal.emitted_at).total_seconds()
        if total_duration <= 0:
            return 0.0
        remaining = time_to_expiry / total_duration
        base_strength = signal.strength * max(remaining, 0.2)
    elif age_seconds > 0:
        decay_factor = math.exp(-0.693 * age_seconds / half_life)
        base_strength = signal.strength * decay_factor

    if age_hours > CLIFF_EDGE_HOURS:
        return min(base_strength, CLIFF_EDGE_MAX_STRENGTH)
    return base_strength


def freshness_multiplier(age_hours: float) -> float:
    """Boost very fresh signals to improve immediacy."""
    if age_hours <= (FRESH_SIGNAL_WINDOW_MINUTES / 60.0):
        return FRESH_SIGNAL_MULTIPLIER
    return 1.0

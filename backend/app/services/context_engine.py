"""Layer 1: Context Engine — builds ContextState from geo, time, weather, energy, group size.

MVP implementation: derives time_of_day and day_type from current timestamp,
fetches weather from OpenWeatherMap when configured (safe fallback otherwise),
defaults energy to MODERATE.
Persists a ContextState row for logging and traceability.
"""

import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.context_state import ContextState, DayType, EnergyLevel
from app.schemas.decide import DecideRequest

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
DEFAULT_WEATHER_CONDITION = "clear"
DEFAULT_WEATHER_TEMP_F = 68.0
DEFAULT_WEATHER_PRECIP = 0.0


def _resolve_time_of_day(hour: int) -> str:
    """Map hour (0-23) to a human-readable time-of-day bucket."""
    if 5 <= hour < 11:
        return "morning"
    if 11 <= hour < 14:
        return "lunch"
    if 14 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    return "late_night"


def _resolve_day_type(dt: datetime) -> DayType:
    """Determine if the current day is a weekday, weekend, or holiday."""
    # MVP: weekday vs weekend only. Holidays can be added later.
    if dt.weekday() >= 5:  # Saturday=5, Sunday=6
        return DayType.WEEKEND
    return DayType.WEEKDAY


async def _resolve_weather(lat: float, lng: float) -> tuple[str, float, float]:
    """Fetch current weather from OpenWeatherMap with safe defaults on failure."""
    if not settings.openweathermap_api_key:
        return (DEFAULT_WEATHER_CONDITION, DEFAULT_WEATHER_TEMP_F, DEFAULT_WEATHER_PRECIP)

    params = {
        "lat": lat,
        "lon": lng,
        "appid": settings.openweathermap_api_key,
        "units": "imperial",
    }

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(OPENWEATHER_URL, params=params)
            resp.raise_for_status()
        payload = resp.json()
    except Exception:
        return (DEFAULT_WEATHER_CONDITION, DEFAULT_WEATHER_TEMP_F, DEFAULT_WEATHER_PRECIP)

    weather_list = payload.get("weather")
    condition = DEFAULT_WEATHER_CONDITION
    if isinstance(weather_list, list) and weather_list:
        first_weather = weather_list[0]
        if isinstance(first_weather, dict):
            condition = str(first_weather.get("main", DEFAULT_WEATHER_CONDITION)).lower()

    main_obj = payload.get("main")
    temp = DEFAULT_WEATHER_TEMP_F
    if isinstance(main_obj, dict):
        raw_temp = main_obj.get("temp")
        if isinstance(raw_temp, (int, float)):
            temp = float(raw_temp)

    # Current-weather API does not expose direct precip probability.
    precip_probability = DEFAULT_WEATHER_PRECIP
    has_rain = isinstance(payload.get("rain"), dict)
    has_snow = isinstance(payload.get("snow"), dict)
    if has_rain or has_snow:
        precip_probability = 1.0

    return (condition, temp, precip_probability)


async def build_context_state(
    request: DecideRequest,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ContextState:
    """Aggregate device signals and declared intent into a ContextState snapshot.

    MVP: Uses current UTC time for time_of_day/day_type, weather from OWM with fallback.
    Full implementation will add forecast windows + behavioral energy inference.
    """
    now = datetime.now(timezone.utc)
    weather_condition, weather_temp, weather_precip = await _resolve_weather(
        request.geo.lat,
        request.geo.lng,
    )

    # Build WKT POINT for PostGIS
    geo_wkt = f"SRID=4326;POINT({request.geo.lng} {request.geo.lat})"

    context = ContextState(
        id=uuid.uuid4(),
        user_id=user_id,
        timestamp=now,
        geo=geo_wkt,
        geo_accuracy=0.0,
        time_of_day=_resolve_time_of_day(now.hour),
        day_type=_resolve_day_type(now),
        weather_condition=weather_condition,
        weather_temp=weather_temp,
        weather_precip_probability=weather_precip,
        group_size=request.group_size,
        intent_declared=request.intent,
        energy_inferred=EnergyLevel.MODERATE,
        session_id=request.session_id or uuid.uuid4(),
    )

    db.add(context)
    await db.flush()  # Assigns ID, but doesn't commit (let router manage transaction)

    return context

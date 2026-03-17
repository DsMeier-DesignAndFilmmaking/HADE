"""
seed_denver_venues.py — inserts 8 iconic Denver venues into the 'venues' table.

Usage:
    DATABASE_URL=postgresql://... python scripts/seed_denver_venues.py

Rewrites postgres:// → plain postgresql:// automatically (asyncpg expects no dialect prefix).
Idempotent: uses a unique index on 'name' and ON CONFLICT DO NOTHING.

IMPORTANT: The 'external_id' column must match a Google Places place_id for a venue
to be linked to live Places results in the /decide pipeline. The values below are
left as NULL — to enable full integration, replace them with real place_ids from
the Google Places API (https://developers.google.com/maps/documentation/places).
"""

import asyncio
import os
import sys


# ---------------------------------------------------------------------------
# Venue data: (name, category, lat, lng, address, price_tier, verified)
# Coordinates are accurate to ~10m for each venue.
# ---------------------------------------------------------------------------

VENUES = [
    ("Blue Sparrow Coffee",  "cafe",        39.7527, -104.9997, "1705 17th St, Denver, CO 80202",        1, True),
    ("Denver Milk Market",   "food_hall",   39.7543, -104.9993, "1800 Wazee St, Denver, CO 80202",       2, True),
    ("Union Station Bar",    "bar",         39.7527, -105.0002, "1701 Wynkoop St, Denver, CO 80202",     2, True),
    ("Ratio Beerworks",      "bar",         39.7650, -104.9845, "2920 Larimer St, Denver, CO 80205",     2, True),
    ("Snooze AM Eatery",     "restaurant",  39.7510, -104.9951, "2262 Larimer St, Denver, CO 80205",     2, True),
    ("The Source Hotel",     "bar",         39.7648, -104.9841, "3330 Brighton Blvd, Denver, CO 80216",  3, True),
    ("Crema Coffee House",   "cafe",        39.7339, -104.9773, "2862 Larimer St, Denver, CO 80205",     1, True),
    ("Linger Restaurant",    "restaurant",  39.7574, -105.0109, "2030 W 30th Ave, Denver, CO 80211",     3, True),
]


def _raw_url(url: str) -> str:
    """Strip the +asyncpg dialect prefix so asyncpg can connect directly."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


def _safe_url(url: str) -> str:
    """Redact password for safe printing."""
    try:
        from sqlalchemy.engine import make_url
        return make_url(url).render_as_string(hide_password=True)
    except Exception:
        import re
        return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", url)


async def seed(raw_db_url: str) -> None:
    try:
        import asyncpg  # type: ignore
    except ImportError:
        print("ERROR: asyncpg not installed — run: pip install asyncpg")
        sys.exit(1)

    url = _raw_url(raw_db_url)
    print(f"Connecting to: {_safe_url(url)}")

    try:
        conn = await asyncpg.connect(url, timeout=10)
    except Exception as e:
        print(f"FAILED to connect — {type(e).__name__}: {e}")
        sys.exit(1)

    # Ensure idempotent: create a unique index on name if it doesn't exist.
    # This allows ON CONFLICT (name) DO NOTHING to work correctly.
    await conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_venues_name ON venues(name);
    """)

    inserted = 0
    skipped = 0

    for name, category, lat, lng, address, price_tier, verified in VENUES:
        # ST_MakePoint(lng, lat) — note longitude-first for PostGIS.
        result = await conn.execute("""
            INSERT INTO venues (
                id,
                name,
                category,
                geo,
                address,
                price_tier,
                is_open_now,
                verified
            )
            VALUES (
                gen_random_uuid(),
                $1,
                $2,
                ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
                $5,
                $6,
                TRUE,
                $7
            )
            ON CONFLICT (name) DO NOTHING
        """, name, category, lat, lng, address, price_tier, verified)

        # asyncpg returns "INSERT 0 N" — N=1 means inserted, N=0 means conflict
        if result == "INSERT 0 1":
            print(f"  ✅ Inserted  → {name}")
            inserted += 1
        else:
            print(f"  ⏭️  Skipped   → {name} (already exists)")
            skipped += 1

    await conn.close()
    print(f"\nDone. {inserted} inserted, {skipped} already existed.")
    print(
        "\nNOTE: Set 'external_id' on these rows to the matching Google Places place_id\n"
        "      to enable signal-to-venue linking in the /decide pipeline."
    )


if __name__ == "__main__":
    raw = os.getenv("DATABASE_URL", "").strip()
    if not raw:
        print("ERROR: DATABASE_URL env var is not set.")
        print("Usage: DATABASE_URL=postgresql://... python scripts/seed_denver_venues.py")
        sys.exit(1)
    asyncio.run(seed(raw))

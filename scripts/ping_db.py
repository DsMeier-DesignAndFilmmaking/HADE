"""
ping_db.py — quick connectivity check for the HADE database.

Usage:
    DATABASE_URL=postgresql://... python scripts/ping_db.py

Rewrites postgres:// → postgresql+asyncpg:// automatically (same logic as
backend/app/core/config.py) so it works with raw Railway / Supabase URLs.
"""

import asyncio
import os
import sys


def _rewrite_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _safe_url(url: str) -> str:
    """Redact password from URL for safe printing."""
    try:
        from sqlalchemy.engine import make_url
        return make_url(url).render_as_string(hide_password=True)
    except Exception:
        # Fallback: crude redaction without sqlalchemy
        import re
        return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", url)


async def ping(url: str) -> None:
    try:
        import asyncpg  # type: ignore
    except ImportError:
        print("ERROR: asyncpg not installed — run: pip install asyncpg")
        sys.exit(1)

    print(f"Connecting to: {_safe_url(url)}")

    # asyncpg uses plain postgresql:// — strip the +asyncpg dialect prefix
    raw_url = url.replace("postgresql+asyncpg://", "postgresql://")

    try:
        conn = await asyncpg.connect(raw_url, timeout=10)
        row = await conn.fetchrow("SELECT version(), now()")
        await conn.close()
        print(f"SUCCESS — {row['version'][:60]}...")
        print(f"Server time: {row['now']}")
    except OSError as e:
        print(f"REFUSED — cannot reach host: {e}")
        sys.exit(1)
    except asyncpg.InvalidPasswordError:
        print("REFUSED — invalid password (host reachable, credentials wrong)")
        sys.exit(1)
    except asyncpg.InvalidCatalogNameError as e:
        print(f"REFUSED — database does not exist: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"REFUSED — {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    raw = os.getenv("DATABASE_URL", "").strip()
    if not raw:
        print("ERROR: DATABASE_URL env var is not set")
        sys.exit(1)
    asyncio.run(ping(_rewrite_url(raw)))

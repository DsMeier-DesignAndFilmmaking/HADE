import logging
from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

logger = logging.getLogger(__name__)


def _safe_db_url(url: str) -> str:
    """Return the DB URL with the password redacted for safe logging."""
    try:
        parsed = make_url(url)
        return parsed.render_as_string(hide_password=True)
    except Exception:
        return "<unparseable DATABASE_URL>"


try:
    engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        connect_args={
            "prepared_statement_cache_size": 0,
            "statement_cache_size": 0,
        },
    )
    logger.info("DB engine created: %s", _safe_db_url(settings.database_url))
except Exception as exc:
    logger.critical(
        "Connection failed: check your DATABASE_URL (%s) — %s",
        _safe_db_url(settings.database_url),
        exc,
    )
    raise

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session."""
    async with async_session_factory() as session:
        yield session

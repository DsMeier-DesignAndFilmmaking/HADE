"""Backward-compatible re-export.

All JWT validation logic now lives in ``app.api.deps``.
Existing routers that ``from app.core.security import get_current_user_id``
continue to work without changes.
"""

from app.api.deps import bearer_scheme, get_current_user_id  # noqa: F401

__all__ = ["bearer_scheme", "get_current_user_id"]

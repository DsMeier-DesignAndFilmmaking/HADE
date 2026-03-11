"""align_user_id_with_auth

Revision ID: a1b2c3d4e5f6
Revises: f6c8b9e21d4a
Create Date: 2026-03-09 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "f6c8b9e21d4a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Set server defaults so the trigger can insert without all fields
    op.alter_column(
        "users",
        "onboarding_complete",
        server_default=sa.text("false"),
    )
    op.alter_column(
        "users",
        "home_city",
        server_default=sa.text("'Unknown'"),
    )


def downgrade() -> None:
    op.alter_column("users", "home_city", server_default=None)
    op.alter_column("users", "onboarding_complete", server_default=None)

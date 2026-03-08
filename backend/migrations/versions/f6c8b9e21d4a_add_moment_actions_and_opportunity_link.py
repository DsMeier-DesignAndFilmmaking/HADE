"""add_moment_actions_and_opportunity_link

Revision ID: f6c8b9e21d4a
Revises: 28fd1e9ca771
Create Date: 2026-03-07 14:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f6c8b9e21d4a"
down_revision: str | None = "28fd1e9ca771"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'momentaction'
          ) THEN
            CREATE TYPE momentaction AS ENUM ('ACCEPTED', 'DISMISSED', 'IGNORED');
          END IF;
        END
        $$;
        """
    )

    op.add_column(
        "moments",
        sa.Column("opportunity_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute("UPDATE moments SET opportunity_id = id WHERE opportunity_id IS NULL")
    op.alter_column("moments", "opportunity_id", nullable=False)

    op.add_column(
        "moments",
        sa.Column(
            "action",
            sa.Enum("ACCEPTED", "DISMISSED", "IGNORED", name="momentaction"),
            nullable=False,
            server_default="IGNORED",
        ),
    )
    op.alter_column("moments", "action", server_default=None)

    op.alter_column("moments", "venue_id", nullable=True)


def downgrade() -> None:
    op.alter_column("moments", "venue_id", nullable=False)

    op.drop_column("moments", "action")
    op.drop_column("moments", "opportunity_id")

    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'momentaction'
          ) THEN
            DROP TYPE momentaction;
          END IF;
        END
        $$;
        """
    )

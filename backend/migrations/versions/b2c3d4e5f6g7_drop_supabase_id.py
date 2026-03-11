"""drop_supabase_id_column

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-09 18:00:00.000000

The supabase_id column is fully redundant — public.users.id is already set to
the Supabase auth.users.id UUID via auto-provisioning and the database trigger.
Removing it simplifies the data model and eliminates drift risk.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6g7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_users_supabase_id"), table_name="users")
    op.drop_column("users", "supabase_id")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("supabase_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        op.f("ix_users_supabase_id"), "users", ["supabase_id"], unique=True
    )

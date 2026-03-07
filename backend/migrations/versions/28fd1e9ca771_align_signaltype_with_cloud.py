"""align_signaltype_with_cloud

Revision ID: 28fd1e9ca771
Revises: c4e7f2a91b3d
Create Date: 2026-03-06 17:32:17.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "28fd1e9ca771"
down_revision: Union[str, None] = "c4e7f2a91b3d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure the enum exists even when signals.type was created as TEXT in Supabase SQL editor.
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'signaltype'
          ) THEN
            CREATE TYPE signaltype AS ENUM (
              'PRESENCE',
              'SOCIAL_RELAY',
              'ENVIRONMENTAL',
              'BEHAVIORAL',
              'AMBIENT',
              'EVENT'
            );
          END IF;
        END
        $$;
        """
    )

    # Backfill EVENT when the enum exists but predates the micro-events migration.
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = 'signaltype'
              AND e.enumlabel = 'EVENT'
          ) THEN
            ALTER TYPE signaltype ADD VALUE 'EVENT';
          END IF;
        END
        $$;
        """
    )

    # Align public.signals.type to the enum when it is still TEXT/VARCHAR.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'signals'
              AND column_name = 'type'
              AND data_type IN ('text', 'character varying')
          ) THEN
            ALTER TABLE public.signals
              ALTER COLUMN type TYPE signaltype
              USING UPPER(type)::signaltype;
          END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # Keep enum type in place to avoid breaking dependent objects.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'signals'
              AND column_name = 'type'
              AND udt_name = 'signaltype'
          ) THEN
            ALTER TABLE public.signals
              ALTER COLUMN type TYPE text
              USING type::text;
          END IF;
        END
        $$;
        """
    )

"""add_email_and_make_phone_nullable

Revision ID: b8e3c1a72f4d
Revises: 0069f1fa59b6
Create Date: 2026-03-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8e3c1a72f4d'
down_revision: Union[str, None] = '0069f1fa59b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add email column (nullable, unique)
    op.add_column('users', sa.Column('email', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Make phone nullable — email-only users won't have a phone number.
    # First convert any empty-string phones to NULL to avoid unique violations.
    op.execute("UPDATE users SET phone = NULL WHERE phone = ''")
    op.alter_column('users', 'phone', existing_type=sa.String(length=20), nullable=True)


def downgrade() -> None:
    # Restore phone NOT NULL (set NULLs to empty string first)
    op.execute("UPDATE users SET phone = '' WHERE phone IS NULL")
    op.alter_column('users', 'phone', existing_type=sa.String(length=20), nullable=False)

    # Drop email column
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_column('users', 'email')

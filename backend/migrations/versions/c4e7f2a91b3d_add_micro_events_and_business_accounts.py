"""add_micro_events_and_business_accounts

Revision ID: c4e7f2a91b3d
Revises: b8e3c1a72f4d
Create Date: 2026-03-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'c4e7f2a91b3d'
down_revision: Union[str, None] = 'b8e3c1a72f4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create EventVisibility and EventStatus enums
    event_visibility = sa.Enum('TRUST_NETWORK', 'EXTENDED', 'OPEN', name='eventvisibility')
    event_status = sa.Enum('UPCOMING', 'LIVE', 'ENDED', 'CANCELLED', name='eventstatus')
    event_visibility.create(op.get_bind(), checkfirst=True)
    event_status.create(op.get_bind(), checkfirst=True)

    # Create micro_events table
    op.create_table(
        'micro_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('host_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('venue_id', UUID(as_uuid=True), sa.ForeignKey('venues.id'), nullable=True),
        sa.Column('title', sa.String(80), nullable=False),
        sa.Column('note', sa.String(200), nullable=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('geo', geoalchemy2.Geography(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('visibility', event_visibility, nullable=False, server_default='TRUST_NETWORK'),
        sa.Column('status', event_status, nullable=False, server_default='UPCOMING'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_micro_events_host_user_id', 'micro_events', ['host_user_id'])
    op.create_index('ix_micro_events_status', 'micro_events', ['status'])
    op.create_index('ix_micro_events_expires_at', 'micro_events', ['expires_at'])

    # Create event_interests table
    op.create_table(
        'event_interests',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('event_id', UUID(as_uuid=True), sa.ForeignKey('micro_events.id'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_event_interests_event_id', 'event_interests', ['event_id'])
    op.create_index('ix_event_interests_user_id', 'event_interests', ['user_id'])
    op.create_unique_constraint('uq_event_interests_event_user', 'event_interests', ['event_id', 'user_id'])

    # Create business_accounts table
    op.create_table(
        'business_accounts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('venue_id', UUID(as_uuid=True), sa.ForeignKey('venues.id'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_business_accounts_user_id', 'business_accounts', ['user_id'])
    op.create_unique_constraint('uq_business_accounts_user_venue', 'business_accounts', ['user_id', 'venue_id'])

    # Add EVENT to SignalType enum
    op.execute("ALTER TYPE signaltype ADD VALUE IF NOT EXISTS 'EVENT'")

    # Add event_id FK to signals table
    op.add_column('signals', sa.Column('event_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_signals_event_id', 'signals', 'micro_events', ['event_id'], ['id'])

    # Add event_id FK to opportunities table
    op.add_column('opportunities', sa.Column('event_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_opportunities_event_id', 'opportunities', 'micro_events', ['event_id'], ['id'])


def downgrade() -> None:
    # Drop event_id from opportunities
    op.drop_constraint('fk_opportunities_event_id', 'opportunities', type_='foreignkey')
    op.drop_column('opportunities', 'event_id')

    # Drop event_id from signals
    op.drop_constraint('fk_signals_event_id', 'signals', type_='foreignkey')
    op.drop_column('signals', 'event_id')

    # Note: Cannot remove enum values in PostgreSQL, EVENT stays in signaltype

    # Drop business_accounts
    op.drop_table('business_accounts')

    # Drop event_interests
    op.drop_table('event_interests')

    # Drop micro_events
    op.drop_table('micro_events')

    # Drop enums
    sa.Enum(name='eventstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='eventvisibility').drop(op.get_bind(), checkfirst=True)

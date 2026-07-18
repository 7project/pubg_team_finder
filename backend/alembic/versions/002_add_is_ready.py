"""Add is_ready to match_participants

Revision ID: 002_add_is_ready
Revises: 001_initial_schema
Create Date: 2026-05-06 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '002_add_is_ready'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('match_participants',
        sa.Column('is_ready', sa.Boolean(), nullable=True, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('match_participants', 'is_ready')

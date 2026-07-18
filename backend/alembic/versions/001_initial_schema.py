"""Initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-05-04 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('discord_id', sa.String(255), nullable=False),
        sa.Column('username', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('internal_name', sa.String(255), nullable=False),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('tiktok_link', sa.String(500), nullable=True),
        sa.Column('youtube_shorts_link', sa.String(500), nullable=True),
        sa.Column('pubg_nickname', sa.String(255), nullable=True),
        sa.Column('pubg_rank', sa.String(50), nullable=True),
        sa.Column('op_gg_link', sa.String(500), nullable=True),
        sa.Column('privacy_setting', sa.Enum('GROUP_ONLY', 'PUBLIC', 'NO_INVITES', name='privacysetting'), nullable=True),
        sa.Column('status', sa.Enum('ACTIVE', 'BUSY', 'OFFLINE', name='userstatus'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('discord_id'),
        sa.UniqueConstraint('internal_name'),
    )
    op.create_index('ix_users_pubg_nickname', 'users', ['pubg_nickname'], unique=False)

    op.create_table('groups',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('matches',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', name='matchstatus'), nullable=True),
        sa.Column('match_type', sa.Enum('SQUAD', 'DUO', 'CUSTOM', name='matchtype'), nullable=True),
        sa.Column('max_players', sa.Integer(), nullable=True),
        sa.Column('discord_channel_id', sa.String(255), nullable=True),
        sa.Column('discord_invite_link', sa.String(500), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('player_stats',
        sa.Column('op_gg_identifier', sa.String(255), nullable=False),
        sa.Column('rank_tier', sa.String(50), nullable=True),
        sa.Column('kd_ratio', sa.Numeric(5, 2), nullable=True),
        sa.Column('wins', sa.Integer(), nullable=True),
        sa.Column('games_played', sa.Integer(), nullable=True),
        sa.Column('avg_damage', sa.Numeric(6, 2), nullable=True),
        sa.Column('data_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('fetched_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('op_gg_identifier'),
    )

    op.create_table('group_members',
        sa.Column('group_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(50), nullable=True),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('group_id', 'user_id'),
    )

    op.create_table('match_participants',
        sa.Column('match_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.Enum('INVITED', 'ACCEPTED', 'DECLINED', name='matchparticipantstatus'), nullable=True),
        sa.Column('invited_at', sa.DateTime(), nullable=True),
        sa.Column('responded_at', sa.DateTime(), nullable=True),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('match_id', 'user_id'),
    )

    op.create_table('ratings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('match_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('to_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('friendliness', sa.Integer(), nullable=True),
        sa.Column('skill', sa.Integer(), nullable=True),
        sa.Column('adequacy', sa.Integer(), nullable=True),
        sa.Column('character_rating', sa.Integer(), nullable=True),
        sa.Column('activity_level', sa.Enum('ACTIVE', 'PASSIVE', 'AVERAGE', name='activitylevel'), nullable=True),
        sa.Column('is_inadequate', sa.Boolean(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['from_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ),
        sa.ForeignKeyConstraint(['to_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('ratings')
    op.drop_table('match_participants')
    op.drop_table('group_members')
    op.drop_table('player_stats')
    op.drop_table('matches')
    op.drop_table('groups')
    op.drop_index('ix_users_pubg_nickname', table_name='users')
    op.drop_table('users')

from datetime import datetime
from enum import Enum as PyEnum
from uuid import uuid4

from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class PrivacySetting(str, PyEnum):
    GROUP_ONLY = "GROUP_ONLY"
    PUBLIC = "PUBLIC"
    NO_INVITES = "NO_INVITES"


class ActivityLevel(str, PyEnum):
    ACTIVE = "ACTIVE"
    PASSIVE = "PASSIVE"
    AVERAGE = "AVERAGE"


class MatchStatus(str, PyEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class UserStatus(str, PyEnum):
    ACTIVE = "ACTIVE"
    BUSY = "BUSY"
    OFFLINE = "OFFLINE"


class MatchType(str, PyEnum):
    SQUAD = "SQUAD"
    DUO = "DUO"
    CUSTOM = "CUSTOM"


class MatchParticipantStatus(str, PyEnum):
    INVITED = "INVITED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    discord_id = Column(String(255), unique=True, nullable=False)
    username = Column(String(255), nullable=False)
    display_name = Column(String(255))
    internal_name = Column(String(255), unique=True, nullable=False)
    avatar_url = Column(Text)
    tiktok_link = Column(String(500))
    youtube_shorts_link = Column(String(500))
    pubg_nickname = Column(String(255), index=True)
    pubg_rank = Column(String(50))
    op_gg_link = Column(String(500))
    privacy_setting = Column(Enum(PrivacySetting), default=PrivacySetting.PUBLIC)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    groups = relationship("Group", back_populates="owner", lazy="dynamic")
    memberships = relationship("GroupMember", back_populates="user", lazy="dynamic")
    matches_created = relationship("Match", back_populates="creator", lazy="dynamic")
    ratings_given = relationship("Rating", back_populates="from_user", foreign_keys="Rating.from_user_id", lazy="dynamic")
    ratings_received = relationship("Rating", back_populates="to_user", foreign_keys="Rating.to_user_id", lazy="dynamic")
    notifications = relationship("Notification", back_populates="user", lazy="dynamic")


class Group(Base):
    __tablename__ = "groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="groups")
    members = relationship("GroupMember", back_populates="group", lazy="selectin", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role = Column(String(50), default="member")
    joined_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Match(Base):
    __tablename__ = "matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(Enum(MatchStatus), default=MatchStatus.PENDING)
    match_type = Column(Enum(MatchType), default=MatchType.SQUAD)
    max_players = Column(Integer, default=4)
    discord_channel_id = Column(String(255))
    discord_invite_link = Column(String(500))
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", back_populates="matches_created")
    participants = relationship("MatchParticipant", back_populates="match", lazy="selectin", cascade="all, delete-orphan")
    ratings = relationship("Rating", back_populates="match", lazy="dynamic", cascade="all, delete-orphan")


class MatchParticipant(Base):
    __tablename__ = "match_participants"

    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    status = Column(Enum(MatchParticipantStatus), default=MatchParticipantStatus.INVITED)
    is_ready = Column(Boolean, default=False)
    invited_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime)
    joined_at = Column(DateTime)

    match = relationship("Match", back_populates="participants")
    user = relationship("User")


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False)
    from_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    friendliness = Column(Integer)
    skill = Column(Integer)
    adequacy = Column(Integer)
    character_rating = Column(Integer)
    activity_level = Column(Enum(ActivityLevel))
    is_inadequate = Column(Boolean, default=False)
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    match = relationship("Match", back_populates="ratings")
    from_user = relationship("User", back_populates="ratings_given", foreign_keys=[from_user_id])
    to_user = relationship("User", back_populates="ratings_received", foreign_keys=[to_user_id])


class PlayerStats(Base):
    __tablename__ = "player_stats"

    op_gg_identifier = Column(String(255), primary_key=True)
    rank_tier = Column(String(50))
    kd_ratio = Column(Numeric(5, 2))
    wins = Column(Integer)
    games_played = Column(Integer)
    avg_damage = Column(Numeric(6, 2))
    data_json = Column(JSON)
    fetched_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
    match = relationship("Match", foreign_keys=[match_id])
from datetime import datetime
from typing import Optional, List, Generic, TypeVar, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.models.models import PrivacySetting, ActivityLevel, MatchStatus


T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    has_more: bool

    @classmethod
    def create(cls, items: List[T], total: int, params: PaginationParams) -> "PaginatedResponse[T]":
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            has_more=(params.skip + len(items)) < total
        )


class UserBase(BaseModel):
    username: str
    display_name: Optional[str] = None
    pubg_nickname: Optional[str] = None
    pubg_rank: Optional[str] = None
    op_gg_link: Optional[str] = None
    tiktok_link: Optional[str] = None
    youtube_shorts_link: Optional[str] = None
    privacy_setting: PrivacySetting = PrivacySetting.PUBLIC


class UserCreate(UserBase):
    discord_id: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    pubg_nickname: Optional[str] = None
    pubg_rank: Optional[str] = None
    op_gg_link: Optional[str] = None
    tiktok_link: Optional[str] = None
    youtube_shorts_link: Optional[str] = None
    privacy_setting: Optional[PrivacySetting] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    discord_id: str
    internal_name: str
    avatar_url: Optional[str] = None
    status: Optional[str] = None
    discord_invite_link: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserPublicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: Optional[str] = None
    pubg_nickname: Optional[str] = None
    pubg_rank: Optional[str] = None
    avatar_url: Optional[str] = None
    privacy_setting: PrivacySetting
    average_rating: Optional[float] = None


class GroupBase(BaseModel):
    name: str
    is_public: bool = True


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    is_public: Optional[bool] = None


class GroupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    group_id: UUID
    role: str
    joined_at: datetime
    user: UserResponse


class GroupMemberSimple(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    user_id: UUID
    role: str
    joined_at: datetime


class GroupResponse(GroupBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime
    members: List[GroupMemberResponse] = []


class MatchBase(BaseModel):
    pass


class MatchCreate(MatchBase):
    invited_user_ids: List[UUID] = []
    match_type: Optional[str] = "SQUAD"
    max_players: Optional[int] = None


class MatchParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    match_id: UUID
    status: str
    is_ready: bool = False
    invited_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    joined_at: Optional[datetime] = None
    user: Optional[UserPublicResponse] = None


class MatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_by: UUID
    status: MatchStatus
    match_type: Optional[str] = None
    max_players: Optional[int] = None
    discord_channel_id: Optional[str] = None
    discord_invite_link: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    participants: List[MatchParticipantResponse] = []


class RatingBase(BaseModel):
    to_user_id: UUID
    friendliness: Optional[int] = None
    skill: Optional[int] = None
    adequacy: Optional[int] = None
    character_rating: Optional[int] = None
    activity_level: Optional[ActivityLevel] = None
    is_inadequate: bool = False
    comment: Optional[str] = None


class RatingCreate(RatingBase):
    match_id: UUID


class RatingResponse(RatingBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    match_id: UUID
    from_user_id: UUID
    created_at: datetime


class PlayerStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    op_gg_identifier: str
    rank_tier: Optional[str] = None
    kd_ratio: Optional[float] = None
    wins: Optional[int] = None
    games_played: Optional[int] = None
    avg_damage: Optional[float] = None
    fetched_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MatchSuggestionResponse(BaseModel):
    users: List[UserPublicResponse]
    from_group: List[UserPublicResponse]


class NotificationType(str):
    INVITE = "invite"
    MATCH_READY = "match_ready"
    MATCH_CANCELLED = "match_cancelled"
    PARTICIPANT_REMOVED = "participant_removed"
    CONFIRMATION_REQUESTED = "confirmation_requested"
    INVITE_ACCEPTED = "invite_accepted"
    MATCH_LEFT = "match_left"


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    type: str
    match_id: Optional[UUID] = None
    title: str
    message: str
    read: bool = False
    created_at: datetime


class RatingStatsResponse(BaseModel):
    rating_average: Optional[float] = None
    rating_count: int = 0
    friendliness_avg: Optional[float] = None
    skill_avg: Optional[float] = None
    adequacy_avg: Optional[float] = None
    character_avg: Optional[float] = None
    activity_avg: Optional[float] = None


class MatchUpdate(BaseModel):
    name: Optional[str] = None
    discord_channel_id: Optional[str] = None
    discord_channel_name: Optional[str] = None
    discord_invite_link: Optional[str] = None
    main_channel: Optional[str] = None
import pytest
from uuid import uuid4
from datetime import datetime
from app.models.models import (
    User, UserStatus, PrivacySetting,
    Match, MatchStatus, MatchType,
    MatchParticipant, MatchParticipantStatus,
    Rating, ActivityLevel, Group, GroupMember, PlayerStats
)


class TestUserModel:
    def test_user_creation(self):
        user = User(
            discord_id="123456789",
            username="testuser",
            display_name="Test User",
            internal_name="testuser_123456",
            pubg_nickname="testpubg",
            pubg_rank="Gold",
            privacy_setting=PrivacySetting.PUBLIC,
            status=UserStatus.ACTIVE,
        )
        assert user.username == "testuser"
        assert user.status == UserStatus.ACTIVE
        assert user.privacy_setting == PrivacySetting.PUBLIC

    def test_user_status_enum(self):
        assert UserStatus.ACTIVE == "ACTIVE"
        assert UserStatus.BUSY == "BUSY"
        assert UserStatus.OFFLINE == "OFFLINE"


class TestMatchModel:
    def test_match_creation(self):
        match = Match(
            created_by=uuid4(),
            status=MatchStatus.PENDING,
            match_type=MatchType.SQUAD,
            max_players=4,
        )
        assert match.match_type == MatchType.SQUAD
        assert match.max_players == 4
        assert match.status == MatchStatus.PENDING

    def test_match_types(self):
        squad = Match(created_by=uuid4(), match_type=MatchType.SQUAD, max_players=4)
        duo = Match(created_by=uuid4(), match_type=MatchType.DUO, max_players=2)
        custom = Match(created_by=uuid4(), match_type=MatchType.CUSTOM, max_players=10)

        assert squad.max_players == 4
        assert duo.max_players == 2
        assert custom.max_players == 10


class TestMatchParticipantModel:
    def test_participant_creation(self):
        participant = MatchParticipant(
            match_id=uuid4(),
            user_id=uuid4(),
            status=MatchParticipantStatus.INVITED,
            invited_at=datetime.utcnow(),
        )
        assert participant.status == MatchParticipantStatus.INVITED
        assert participant.invited_at is not None

    def test_participant_accepted(self):
        participant = MatchParticipant(
            match_id=uuid4(),
            user_id=uuid4(),
            status=MatchParticipantStatus.ACCEPTED,
            joined_at=datetime.utcnow(),
        )
        assert participant.status == MatchParticipantStatus.ACCEPTED
        assert participant.joined_at is not None


class TestEnums:
    def test_user_status_values(self):
        assert UserStatus.ACTIVE == "ACTIVE"
        assert UserStatus.BUSY == "BUSY"
        assert UserStatus.OFFLINE == "OFFLINE"

    def test_match_type_values(self):
        assert MatchType.SQUAD == "SQUAD"
        assert MatchType.DUO == "DUO"
        assert MatchType.CUSTOM == "CUSTOM"

    def test_participant_status_values(self):
        assert MatchParticipantStatus.INVITED == "INVITED"
        assert MatchParticipantStatus.ACCEPTED == "ACCEPTED"
        assert MatchParticipantStatus.DECLINED == "DECLINED"

    def test_match_status_values(self):
        assert MatchStatus.PENDING == "PENDING"
        assert MatchStatus.ACTIVE == "ACTIVE"
        assert MatchStatus.COMPLETED == "COMPLETED"
        assert MatchStatus.CANCELLED == "CANCELLED"

    def test_privacy_setting_values(self):
        assert PrivacySetting.PUBLIC == "PUBLIC"
        assert PrivacySetting.GROUP_ONLY == "GROUP_ONLY"
        assert PrivacySetting.NO_INVITES == "NO_INVITES"

    def test_activity_level_values(self):
        assert ActivityLevel.ACTIVE == "ACTIVE"
        assert ActivityLevel.PASSIVE == "PASSIVE"
        assert ActivityLevel.AVERAGE == "AVERAGE"
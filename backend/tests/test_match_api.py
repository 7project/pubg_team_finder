import pytest
from uuid import uuid4
from app.models.models import User, UserStatus, PrivacySetting, Match, MatchStatus, MatchType
from app.schemas.schemas import MatchCreate, UserUpdate


class TestMatchCreateSchema:
    def test_match_create_squad(self):
        """Test MatchCreate schema with SQUAD type"""
        match = MatchCreate(invited_user_ids=[], match_type="SQUAD")
        assert match.match_type == "SQUAD"
        assert match.invited_user_ids == []

    def test_match_create_duo(self):
        """Test MatchCreate schema with DUO type"""
        match = MatchCreate(invited_user_ids=[], match_type="DUO")
        assert match.match_type == "DUO"

    def test_match_create_custom(self):
        """Test MatchCreate schema with CUSTOM type and custom max_players"""
        match = MatchCreate(invited_user_ids=[], match_type="CUSTOM", max_players=6)
        assert match.match_type == "CUSTOM"
        assert match.max_players == 6

    def test_match_create_no_match_type(self):
        """Test MatchCreate schema defaults to SQUAD when no match_type provided"""
        match = MatchCreate(invited_user_ids=[])
        assert match.match_type == "SQUAD"
        assert match.max_players is None

    def test_match_create_with_invited_users(self):
        """Test MatchCreate schema with invited user IDs"""
        user_ids = [uuid4(), uuid4()]
        match = MatchCreate(invited_user_ids=user_ids, match_type="SQUAD")
        assert len(match.invited_user_ids) == 2
        assert match.invited_user_ids[0] == user_ids[0]


class TestUserUpdateSchema:
    def test_user_update_display_name(self):
        """Test UserUpdate schema with display_name"""
        update = UserUpdate(display_name="New Name")
        assert update.display_name == "New Name"

    def test_user_update_pubg_nickname(self):
        """Test UserUpdate schema with pubg_nickname"""
        update = UserUpdate(pubg_nickname="NewPubgNick")
        assert update.pubg_nickname == "NewPubgNick"

    def test_user_update_privacy_setting(self):
        """Test UserUpdate schema with privacy_setting enum"""
        update = UserUpdate(privacy_setting=PrivacySetting.PUBLIC)
        assert update.privacy_setting == PrivacySetting.PUBLIC

    def test_user_update_privacy_setting_string(self):
        """Test UserUpdate schema accepts string for privacy_setting"""
        update = UserUpdate(privacy_setting="GROUP_ONLY")
        assert update.privacy_setting == PrivacySetting.GROUP_ONLY

    def test_user_update_multiple_fields(self):
        """Test UserUpdate schema with multiple fields"""
        update = UserUpdate(
            display_name="New Name",
            pubg_nickname="NewPubg",
            tiktok_link="https://tiktok.com/@test",
            privacy_setting="NO_INVITES"
        )
        assert update.display_name == "New Name"
        assert update.pubg_nickname == "NewPubg"
        assert update.tiktok_link == "https://tiktok.com/@test"
        assert update.privacy_setting == PrivacySetting.NO_INVITES

    def test_user_update_empty(self):
        """Test UserUpdate schema with no fields (all optional)"""
        update = UserUpdate()
        assert update.display_name is None
        assert update.pubg_nickname is None


class TestMatchServiceWithMatchType:
    """Test match service create_match with different match types"""

    @pytest.mark.asyncio
    async def test_create_squad_match_sets_max_players(self):
        """Test that creating a SQUAD match sets max_players to 4"""
        from app.services.match_service import create_match

        class MockSession:
            def __init__(self):
                self.users = {}
                self.matches = {}
                self.participants = []
                self.committed = False
                self.flushed = False

            def add(self, obj):
                if isinstance(obj, User):
                    self.users[obj.id] = obj
                elif isinstance(obj, Match):
                    self.matches[obj.id] = obj
                elif hasattr(obj, 'match_id'):
                    self.participants.append(obj)

            async def commit(self):
                self.committed = True

            async def flush(self):
                self.flushed = True
                for user in self.users.values():
                    if user.id is None:
                        user.id = uuid4()
                for match in self.matches.values():
                    if match.id is None:
                        match.id = uuid4()

            async def refresh(self, obj):
                pass

            async def execute(self, query):
                return MockResult(self.users, self.matches, self.participants)

        class MockResult:
            def __init__(self, users, matches, participants):
                self.users = users
                self.matches = matches
                self.participants = participants

            def scalar_one_or_none(self):
                vals = list(self.participants)
                if vals:
                    return vals[-1]
                return None

            def scalars(self):
                return MockScalars(self.participants)

        class MockScalars:
            def __init__(self, participants):
                self.participants = participants

            def all(self):
                return self.participants

        session = MockSession()
        user = User(
            id=uuid4(),
            discord_id="test123",
            username="testuser",
            internal_name="testuser_test",
            status=UserStatus.ACTIVE
        )
        session.add(user)
        await session.flush()

        match = await create_match(
            db=session,
            creator=user,
            match_type=MatchType.SQUAD
        )

        assert match.match_type == MatchType.SQUAD
        assert match.max_players == 4

    @pytest.mark.asyncio
    async def test_create_duo_match_sets_max_players(self):
        """Test that creating a DUO match sets max_players to 2"""
        from app.services.match_service import create_match

        class MockSession:
            def __init__(self):
                self.users = {}
                self.matches = {}
                self.participants = []
                self.committed = False
                self.flushed = False

            def add(self, obj):
                if isinstance(obj, User):
                    self.users[obj.id] = obj
                elif isinstance(obj, Match):
                    self.matches[obj.id] = obj
                elif hasattr(obj, 'match_id'):
                    self.participants.append(obj)

            async def commit(self):
                self.committed = True

            async def flush(self):
                self.flushed = True
                for user in self.users.values():
                    if user.id is None:
                        user.id = uuid4()
                for match in self.matches.values():
                    if match.id is None:
                        match.id = uuid4()

            async def refresh(self, obj):
                pass

            async def execute(self, query):
                return MockResult(self.users, self.matches, self.participants)

        class MockResult:
            def __init__(self, users, matches, participants):
                self.users = users
                self.matches = matches
                self.participants = participants

            def scalar_one_or_none(self):
                vals = list(self.participants)
                if vals:
                    return vals[-1]
                return None

            def scalars(self):
                return MockScalars(self.participants)

        class MockScalars:
            def __init__(self, participants):
                self.participants = participants

            def all(self):
                return self.participants

        session = MockSession()
        user = User(
            id=uuid4(),
            discord_id="test456",
            username="testuser2",
            internal_name="testuser2_test",
            status=UserStatus.ACTIVE
        )
        session.add(user)
        await session.flush()

        match = await create_match(
            db=session,
            creator=user,
            match_type=MatchType.DUO
        )

        assert match.match_type == MatchType.DUO
        assert match.max_players == 2

    @pytest.mark.asyncio
    async def test_create_custom_match_with_custom_max_players(self):
        """Test that creating a CUSTOM match with max_players uses custom value"""
        from app.services.match_service import create_match

        class MockSession:
            def __init__(self):
                self.users = {}
                self.matches = {}
                self.participants = []
                self.committed = False
                self.flushed = False

            def add(self, obj):
                if isinstance(obj, User):
                    self.users[obj.id] = obj
                elif isinstance(obj, Match):
                    self.matches[obj.id] = obj
                elif hasattr(obj, 'match_id'):
                    self.participants.append(obj)

            async def commit(self):
                self.committed = True

            async def flush(self):
                self.flushed = True
                for user in self.users.values():
                    if user.id is None:
                        user.id = uuid4()
                for match in self.matches.values():
                    if match.id is None:
                        match.id = uuid4()

            async def refresh(self, obj):
                pass

            async def execute(self, query):
                return MockResult(self.users, self.matches, self.participants)

        class MockResult:
            def __init__(self, users, matches, participants):
                self.users = users
                self.matches = matches
                self.participants = participants

            def scalar_one_or_none(self):
                vals = list(self.participants)
                if vals:
                    return vals[-1]
                return None

            def scalars(self):
                return MockScalars(self.participants)

        class MockScalars:
            def __init__(self, participants):
                self.participants = participants

            def all(self):
                return self.participants

        session = MockSession()
        user = User(
            id=uuid4(),
            discord_id="test789",
            username="testuser3",
            internal_name="testuser3_test",
            status=UserStatus.ACTIVE
        )
        session.add(user)
        await session.flush()

        match = await create_match(
            db=session,
            creator=user,
            match_type=MatchType.CUSTOM,
            max_players=6
        )

        assert match.match_type == MatchType.CUSTOM
        assert match.max_players == 6

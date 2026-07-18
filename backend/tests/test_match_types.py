import pytest
from uuid import uuid4
from app.models.models import (
    User, UserStatus, PrivacySetting,
    Match, MatchStatus, MatchType,
    MatchParticipant, MatchParticipantStatus
)


class MockAsyncSession:
    """Mock async session that properly simulates SQLAlchemy query behavior."""

    def __init__(self):
        self.users = {}
        self.matches = {}
        self.participants = []
        self.committed = False
        self.flushed = False
        self._query_log = []

    def add(self, obj):
        if isinstance(obj, User):
            self.users[obj.id] = obj
        elif isinstance(obj, Match):
            self.matches[obj.id] = obj
        elif isinstance(obj, MatchParticipant):
            self.participants.append(obj)

    def add_all(self, objs):
        for obj in objs:
            self.add(obj)

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
        self._query_log.append(str(query)[:100])
        return MockResult(self, query)

    async def rollback(self):
        pass

    async def delete(self, obj):
        if obj in self.participants:
            self.participants.remove(obj)


class MockResult:
    """Mock result that properly filters based on query."""

    def __init__(self, session: MockAsyncSession, query):
        self.session = session
        self.query = query
        self._query_str = str(query)
        try:
            self._compiled = query.compile()
            self._params = self._compiled.params if hasattr(self._compiled, 'params') else {}
        except:
            self._compiled = None
            self._params = {}

    def scalar_one_or_none(self):
        """Return single result or None based on query filters."""
        query_lower = self._query_str.lower()

        if 'match_participant' in query_lower or 'matchparticipants' in query_lower:
            return self._get_participant_or_none()
        elif 'user' in query_lower and 'from_user' not in query_lower and 'to_user' not in query_lower:
            return self._get_user_or_none()
        elif 'match' in query_lower:
            return self._get_match_or_none()

        return None

    def _get_user_or_none(self):
        for key, value in self._params.items():
            if isinstance(value, uuid4().__class__):
                return self.session.users.get(value)
        return None

    def _get_match_or_none(self):
        for key, value in self._params.items():
            if isinstance(value, uuid4().__class__):
                return self.session.matches.get(value)
        return None

    def _get_participant_or_none(self):
        match_id = None
        user_id = None

        for key, value in self._params.items():
            if isinstance(value, uuid4().__class__):
                if 'match_id' in key.lower():
                    match_id = value
                elif 'user_id' in key.lower():
                    user_id = value

        for p in self.session.participants:
            if match_id is not None and user_id is not None:
                if p.match_id == match_id and p.user_id == user_id:
                    return p
            elif match_id is not None:
                if p.match_id == match_id:
                    return p
            elif user_id is not None:
                if p.user_id == user_id:
                    return p

        return None

    def scalars(self):
        return MockScalars(self.session, self._query_str, self._params)


class MockScalars:
    """Mock scalars result."""

    def __init__(self, session, query_str, params):
        self.session = session
        self.query_str = query_str
        self.params = params

    def all(self):
        query_lower = self.query_str.lower()

        if 'match_participant' in query_lower or 'matchparticipants' in query_lower:
            match_id = None
            for key, value in self.params.items():
                if isinstance(value, uuid4().__class__) and 'match_id' in key.lower():
                    match_id = value
                    break

            if match_id:
                return [p for p in self.session.participants if p.match_id == match_id]

        return list(self.session.participants)


@pytest.mark.integration
class TestMatchTypes:
    @pytest.mark.asyncio
    async def test_create_squad_match(self):
        """Test creating a Squad match (4 players)"""
        from app.services.match_service import create_match

        session = MockAsyncSession()
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
        assert match.status == MatchStatus.PENDING

    @pytest.mark.asyncio
    async def test_create_duo_match(self):
        """Test creating a Duo match (2 players)"""
        from app.services.match_service import create_match

        session = MockAsyncSession()
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
    async def test_create_custom_match(self):
        """Test creating a Custom match with custom player count"""
        from app.services.match_service import create_match

        session = MockAsyncSession()
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


@pytest.mark.integration
class TestInviteLogic:
    @pytest.mark.asyncio
    async def test_invite_player(self):
        """Test inviting a player to a match"""
        from app.services.match_service import create_match, invite_player

        session = MockAsyncSession()
        creator = User(
            id=uuid4(),
            discord_id="creator123",
            username="creator",
            internal_name="creator_test",
            status=UserStatus.ACTIVE
        )
        invitee = User(
            id=uuid4(),
            discord_id="invitee123",
            username="invitee",
            internal_name="invitee_test",
            status=UserStatus.ACTIVE
        )
        session.add_all([creator, invitee])
        await session.flush()

        match = await create_match(db=session, creator=creator, match_type=MatchType.SQUAD)

        await invite_player(session, match, invitee.id)

        assert len(session.participants) > 1

    @pytest.mark.asyncio
    async def test_invite_busy_player_fails(self):
        """Test that inviting a busy player fails"""
        from app.services.match_service import create_match, invite_player

        session = MockAsyncSession()
        creator = User(
            id=uuid4(),
            discord_id="creator456",
            username="creator2",
            internal_name="creator2_test",
            status=UserStatus.ACTIVE
        )
        busy_player = User(
            id=uuid4(),
            discord_id="busy123",
            username="busy",
            internal_name="busy_test",
            status=UserStatus.BUSY
        )
        session.add_all([creator, busy_player])
        await session.flush()

        match = await create_match(db=session, creator=creator)

        with pytest.raises(ValueError) as exc_info:
            await invite_player(session, match, busy_player.id)
        assert "BUSY" in str(exc_info.value).upper() or "busy" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_invite_exceeds_max_players(self):
        """Test that inviting beyond max_players fails"""
        from app.services.match_service import create_match, invite_player

        session = MockAsyncSession()
        creator = User(
            id=uuid4(),
            discord_id="creator789",
            username="creator3",
            internal_name="creator3_test",
            status=UserStatus.ACTIVE
        )
        session.add(creator)
        await session.flush()

        match = await create_match(db=session, creator=creator, match_type=MatchType.DUO)

        player1 = User(
            id=uuid4(),
            discord_id="p1", username="p1", internal_name="p1_test", status=UserStatus.ACTIVE
        )
        player2 = User(
            id=uuid4(),
            discord_id="p2", username="p2", internal_name="p2_test", status=UserStatus.ACTIVE
        )
        session.add_all([player1, player2])
        await session.flush()

        await invite_player(session, match, player1.id)

        with pytest.raises(ValueError) as exc_info:
            await invite_player(session, match, player2.id)
        error_msg = str(exc_info.value).lower()
        assert "full" in error_msg or "max" in error_msg


@pytest.mark.integration
class TestAcceptDeclineLeave:
    @pytest.mark.asyncio
    async def test_accept_invite(self):
        """Test accepting an invitation"""
        from app.services.match_service import create_match, invite_player, accept_invite

        session = MockAsyncSession()
        creator = User(
            id=uuid4(),
            discord_id="c1", username="c1", internal_name="c1_test", status=UserStatus.ACTIVE
        )
        invitee = User(
            id=uuid4(),
            discord_id="i1", username="i1", internal_name="i1_test", status=UserStatus.ACTIVE
        )
        session.add_all([creator, invitee])
        await session.flush()

        match = await create_match(db=session, creator=creator)
        await invite_player(session, match, invitee.id)

        await accept_invite(session, match, invitee)

        assert invitee.status == UserStatus.BUSY

    @pytest.mark.asyncio
    async def test_leave_match(self):
        """Test leaving a match"""
        from app.services.match_service import create_match, invite_player, accept_invite, leave_match

        session = MockAsyncSession()
        creator = User(
            id=uuid4(),
            discord_id="c2", username="c2", internal_name="c2_test", status=UserStatus.ACTIVE
        )
        member = User(
            id=uuid4(),
            discord_id="m1", username="m1", internal_name="m1_test", status=UserStatus.ACTIVE
        )
        session.add_all([creator, member])
        await session.flush()

        match = await create_match(db=session, creator=creator)
        await invite_player(session, match, member.id)
        await accept_invite(session, match, member)

        await leave_match(session, match, member)

        assert member.status == UserStatus.ACTIVE

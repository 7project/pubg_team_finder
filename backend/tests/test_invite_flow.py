import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, patch

from app.models.models import (
    User, UserStatus, PrivacySetting,
    Match, MatchStatus, MatchType,
    MatchParticipant, MatchParticipantStatus
)
from app.services.match_service import create_match, invite_player, accept_invite, leave_match


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
class TestInviteFlow:
    @pytest.mark.asyncio
    async def test_full_invite_flow(self):
        """Test full flow: create match → invite → accept → leave"""
        session = MockAsyncSession()
        creator = User(
            id=uuid4(),
            discord_id="flow_creator",
            username="flow_creator",
            display_name="Flow Creator",
            internal_name="flow_creator_test",
            status=UserStatus.ACTIVE
        )
        player1 = User(
            id=uuid4(),
            discord_id="flow_player1",
            username="flow_player1",
            display_name="Flow Player 1",
            internal_name="flow_player1_test",
            status=UserStatus.ACTIVE
        )
        player2 = User(
            id=uuid4(),
            discord_id="flow_player2",
            username="flow_player2",
            display_name="Flow Player 2",
            internal_name="flow_player2_test",
            status=UserStatus.ACTIVE
        )
        session.add(creator)
        session.add(player1)
        session.add(player2)

        await session.flush()

        match = await create_match(
            db=session,
            creator=creator,
            match_type=MatchType.SQUAD
        )
        assert match.match_type == MatchType.SQUAD
        assert match.max_players == 4

        await invite_player(session, match, player1.id)
        await invite_player(session, match, player2.id)

        await accept_invite(session, match, player1)
        assert player1.status == UserStatus.BUSY

        await accept_invite(session, match, player2)
        await leave_match(session, match, player2)

        assert player2.status == UserStatus.ACTIVE
        assert match is not None

    @pytest.mark.asyncio
    async def test_cannot_invite_busy_player(self):
        """Test that you cannot invite a player who is already in a match"""
        session = MockAsyncSession()
        creator = User(
            id=uuid4(),
            discord_id="busy_test_creator",
            username="busy_creator",
            internal_name="busy_creator_test",
            status=UserStatus.ACTIVE
        )
        busy_player = User(
            id=uuid4(),
            discord_id="busy_test_player",
            username="busy_player",
            internal_name="busy_player_test",
            status=UserStatus.BUSY
        )
        session.add(creator)
        session.add(busy_player)
        await session.flush()

        match = await create_match(db=session, creator=creator, match_type=MatchType.DUO)

        with pytest.raises(ValueError) as exc_info:
            await invite_player(session, match, busy_player.id)
        assert "BUSY" in str(exc_info.value).upper() or "busy" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_match_full_error(self):
        """Test that you cannot invite beyond max_players"""
        session = MockAsyncSession()
        creator = User(
            id=uuid4(),
            discord_id="full_test_creator",
            username="full_creator",
            internal_name="full_creator_test",
            status=UserStatus.ACTIVE
        )
        session.add(creator)
        await session.flush()

        match = await create_match(db=session, creator=creator, match_type=MatchType.DUO)
        assert match.max_players == 2

        player1 = User(
            id=uuid4(),
            discord_id="full_player_1",
            username="full_player_1",
            internal_name="full_player_1_test",
            status=UserStatus.ACTIVE
        )
        player2 = User(
            id=uuid4(),
            discord_id="full_player_2",
            username="full_player_2",
            internal_name="full_player_2_test",
            status=UserStatus.ACTIVE
        )
        session.add(player1)
        session.add(player2)
        await session.flush()

        await invite_player(session, match, player1.id)

        with pytest.raises(ValueError) as exc_info:
            await invite_player(session, match, player2.id)
        error_msg = str(exc_info.value).lower()
        assert "full" in error_msg or "max" in error_msg

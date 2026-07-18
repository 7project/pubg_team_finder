import pytest
import pytest_asyncio
import asyncio
from datetime import datetime
from uuid import uuid4
from unittest.mock import AsyncMock, patch, MagicMock
from typing import AsyncGenerator, Dict, List, Optional, Any

from sqlalchemy import create_engine, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.models import Base, User, UserStatus, PrivacySetting, Match, MatchParticipant


class MockAsyncSession:
    """Mock async session that properly simulates SQLAlchemy query behavior."""

    def __init__(self):
        self.users: Dict[Any, User] = {}
        self.matches: Dict[Any, Match] = {}
        self.participants: List[MatchParticipant] = []
        self.committed = False
        self.flushed = False
        self._query_log: List[str] = []

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


class MockResult:
    """Mock result that properly filters based on query."""

    def __init__(self, session: MockAsyncSession, query):
        self.session = session
        self.query = query
        self._query_str = str(query)

    def scalar_one_or_none(self):
        """Return single result or None based on query filters."""
        query_lower = self._query_str.lower()

        if 'matchparticipant' in query_lower:
            return self._get_participant_or_none()
        elif 'user' in query_lower and 'from_user' not in query_lower and 'to_user' not in query_lower:
            return self._get_user_or_none()
        elif 'match' in query_lower:
            return self._get_match_or_none()

        return None

    def _get_user_or_none(self) -> Optional[User]:
        """Get user by id from query."""
        import re
        match = re.search(r'User\.id\s*==\s*([^)\s]+)', self._query_str)
        if match:
            user_id_str = match.group(1).strip()
            try:
                from uuid import UUID
                user_id = UUID(user_id_str)
                return self.session.users.get(user_id)
            except (ValueError, AttributeError):
                pass
        return None

    def _get_match_or_none(self) -> Optional[Match]:
        """Get match by id from query."""
        import re
        match = re.search(r'Match\.id\s*==\s*([^)\s]+)', self._query_str)
        if match:
            match_id_str = match.group(1).strip()
            try:
                from uuid import UUID
                match_id = UUID(match_id_str)
                return self.session.matches.get(match_id)
            except (ValueError, AttributeError):
                pass
        return None

    def _get_participant_or_none(self) -> Optional[MatchParticipant]:
        """Get participant by match_id and/or user_id from query."""
        import re

        match_id = None
        user_id = None

        match_id_match = re.search(r'MatchParticipant\.match_id\s*==\s*([^)\s]+)', self._query_str)
        if match_id_match:
            match_id_str = match_id_match.group(1).strip()
            try:
                from uuid import UUID
                match_id = UUID(match_id_str)
            except (ValueError, AttributeError):
                match_id = match_id_str

        user_id_match = re.search(r'MatchParticipant\.user_id\s*==\s*([^)\s]+)', self._query_str)
        if user_id_match:
            user_id_str = user_id_match.group(1).strip()
            try:
                from uuid import UUID
                user_id = UUID(user_id_str)
            except (ValueError, AttributeError):
                user_id = user_id_str

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
        return MockScalars(self.session, self._query_str)


class MockScalars:
    """Mock scalars result."""

    def __init__(self, session: MockAsyncSession, query_str: str):
        self.session = session
        self.query_str = query_str

    def all(self) -> List:
        """Return all matching participants."""
        query_lower = self.query_str.lower()

        if 'matchparticipant' in query_lower and 'match_id' in query_lower:
            import re
            match_id_match = re.search(r'MatchParticipant\.match_id\s*==\s*([^)\s]+)', self.query_str)
            if match_id_match:
                match_id_str = match_id_match.group(1).strip()
                try:
                    from uuid import UUID
                    match_id = UUID(match_id_str)
                except (ValueError, AttributeError):
                    match_id = match_id_str

                return [p for p in self.session.participants if p.match_id == match_id]

        return list(self.session.participants)


@pytest.fixture(scope="session")
def event_loop():
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest.fixture
def sync_db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def sync_db_session(sync_db_engine):
    SessionLocal = sessionmaker(sync_db_engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def test_user(sync_db_session):
    user = User(
        id=uuid4(),
        discord_id="test_discord_123",
        username="testuser",
        display_name="Test User",
        internal_name="testuser_123",
        pubg_nickname="testpubg",
        pubg_rank="Gold",
        privacy_setting=PrivacySetting.PUBLIC,
        status=UserStatus.ACTIVE,
    )
    sync_db_session.add(user)
    sync_db_session.commit()
    return user


@pytest.fixture
def test_user2(sync_db_session):
    user = User(
        id=uuid4(),
        discord_id="test_discord_456",
        username="testuser2",
        display_name="Test User 2",
        internal_name="testuser2_456",
        status=UserStatus.ACTIVE,
    )
    sync_db_session.add(user)
    sync_db_session.commit()
    return user


@pytest.fixture
def busy_user(sync_db_session):
    user = User(
        id=uuid4(),
        discord_id="busy_discord_789",
        username="busyuser",
        display_name="Busy User",
        internal_name="busyuser_789",
        status=UserStatus.BUSY,
    )
    sync_db_session.add(user)
    sync_db_session.commit()
    return user


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


@pytest.fixture
def auth_headers(test_user):
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def mock_kafka():
    from app.core import kafka
    with patch.object(kafka, 'get_kafka_producer', new_callable=AsyncMock) as mock_producer:
        mock_producer.return_value = AsyncMock()
        yield mock_producer
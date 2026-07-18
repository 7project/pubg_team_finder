import pytest
from uuid import uuid4
from datetime import datetime
from unittest.mock import patch, AsyncMock

from app.models.models import (
    User, UserStatus, PrivacySetting,
    Match, MatchStatus, MatchType,
    MatchParticipant, MatchParticipantStatus,
    Group, GroupMember,
    Notification
)
from app.schemas.schemas import (
    PaginationParams, PaginatedResponse,
    NotificationResponse, RatingStatsResponse
)


class TestPaginationParams:
    def test_pagination_defaults(self):
        params = PaginationParams()
        assert params.page == 1
        assert params.page_size == 20
        assert params.skip == 0
        assert params.limit == 20

    def test_pagination_skip_calculation(self):
        params = PaginationParams(page=3, page_size=10)
        assert params.skip == 20
        assert params.limit == 10

    def test_pagination_page_2(self):
        params = PaginationParams(page=2, page_size=15)
        assert params.skip == 15
        assert params.limit == 15


class TestPaginatedResponse:
    def test_create_paginated_response(self):
        items = ["a", "b", "c"]
        params = PaginationParams(page=1, page_size=10)
        total = 25

        response = PaginatedResponse.create(items, total, params)

        assert response.items == items
        assert response.total == 25
        assert response.page == 1
        assert response.page_size == 10
        assert response.has_more is True

    def test_create_paginated_response_no_more(self):
        items = ["a", "b", "c"]
        params = PaginationParams(page=3, page_size=10)
        total = 23

        response = PaginatedResponse.create(items, total, params)

        assert response.has_more is False

    def test_create_paginated_response_exact_fit(self):
        items = ["a", "b", "c", "d", "e"]
        params = PaginationParams(page=2, page_size=5)
        total = 10

        response = PaginatedResponse.create(items, total, params)

        assert response.has_more is False


class TestNotificationModel:
    def test_notification_response_model(self):
        from uuid import uuid4
        from datetime import datetime

        notif = NotificationResponse(
            id=uuid4(),
            user_id=uuid4(),
            type="invite",
            title="Test Invitation",
            message="You have been invited",
            read=False,
            created_at=datetime.utcnow()
        )
        assert notif.type == "invite"
        assert notif.read is False


class TestNotificationTypes:
    def test_notification_type_values(self):
        assert Notification.__tablename__ == "notifications"

    def test_notification_fields_exist(self):
        from app.models.models import Notification
        fields = ['id', 'user_id', 'type', 'match_id', 'title', 'message', 'read', 'created_at']
        for field in fields:
            assert hasattr(Notification, field)


class TestRatingStatsResponse:
    def test_rating_stats_response_defaults(self):
        stats = RatingStatsResponse()
        assert stats.rating_average is None
        assert stats.rating_count == 0
        assert stats.friendliness_avg is None

    def test_rating_stats_response_with_values(self):
        stats = RatingStatsResponse(
            rating_average=4.5,
            rating_count=10,
            friendliness_avg=4.2,
            skill_avg=4.8,
            adequacy_avg=4.5,
            character_avg=4.3,
            activity_avg=4.6
        )
        assert stats.rating_average == 4.5
        assert stats.rating_count == 10
        assert stats.skill_avg == 4.8


class TestMatchParticipantReady:
    def test_participant_has_is_ready_field(self):
        from app.models.models import MatchParticipant
        assert hasattr(MatchParticipant, 'is_ready')

    def test_is_ready_default_is_false(self):
        from app.models.models import MatchParticipant
        participant = MatchParticipant(
            match_id=uuid4(),
            user_id=uuid4(),
            status=MatchParticipantStatus.ACCEPTED,
        )
        assert participant.is_ready is None or participant.is_ready is False


class TestUserNotificationsRelationship:
    def test_user_has_notifications_attribute(self):
        from app.models.models import User
        assert hasattr(User, 'notifications')

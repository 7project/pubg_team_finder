import pytest
from uuid import uuid4
from unittest.mock import patch, AsyncMock


class TestAuthEndpoints:
    def test_me_endpoint_without_token(self, mock_client):
        response = mock_client.get("/api/v1/auth/me")
        assert response.status_code in [401, 403]

    def test_me_endpoint_with_invalid_token(self, mock_client):
        headers = {"Authorization": "Bearer invalid_token"}
        response = mock_client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code in [401, 403]


class TestUsersEndpoints:
    def test_get_me_without_token(self, mock_client):
        response = mock_client.get("/api/v1/users/me")
        assert response.status_code in [401, 403]

    def test_update_me_without_token(self, mock_client):
        response = mock_client.patch(
            "/api/v1/users/me",
            json={"display_name": "Test"}
        )
        assert response.status_code in [401, 403]


class TestMatchesEndpoints:
    def test_create_match_without_token(self, mock_client):
        response = mock_client.post(
            "/api/v1/matches/",
            json={"invited_user_ids": []}
        )
        assert response.status_code in [401, 403]

    def test_list_matches_without_token(self, mock_client):
        response = mock_client.get("/api/v1/matches/")
        assert response.status_code in [401, 403]


class TestGroupsEndpoints:
    def test_create_group_without_token(self, mock_client):
        response = mock_client.post(
            "/api/v1/groups/",
            json={"name": "Test Group", "is_public": True}
        )
        assert response.status_code in [401, 403]


class TestRatingsEndpoints:
    def test_create_rating_without_token(self, mock_client):
        response = mock_client.post(
            "/api/v1/ratings/",
            json={
                "to_user_id": str(uuid4()),
                "match_id": str(uuid4()),
            }
        )
        assert response.status_code in [401, 403]
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app


class TestApiService:
    def setup_method(self):
        self.client = TestClient(app)

    def test_get_auth_headers_without_token(self):
        """Test that requests without token work for public endpoints"""
        # Health check should work without token
        response = self.client.get("/health")
        assert response.status_code == 200

    def test_protected_endpoints_require_auth(self):
        """Test that protected endpoints return 401 without auth"""
        protected_endpoints = [
            ("GET", "/api/v1/auth/me"),
            ("GET", "/api/v1/users/me"),
            ("PATCH", "/api/v1/users/me"),
            ("GET", "/api/v1/matches/"),
            ("POST", "/api/v1/matches/"),
            ("GET", "/api/v1/groups/"),
            ("POST", "/api/v1/groups/"),
            ("POST", "/api/v1/ratings/"),
        ]

        for method, endpoint in protected_endpoints:
            if method == "GET":
                response = self.client.get(endpoint)
            elif method == "POST":
                response = self.client.post(endpoint, json={})
            elif method == "PATCH":
                response = self.client.patch(endpoint, json={})
            
            assert response.status_code == 401, f"{method} {endpoint} should return 401"

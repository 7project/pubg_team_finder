"""
Rate limiting middleware for FastAPI.
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.redis import rate_limiter


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to apply rate limiting to all requests"""

    EXCLUDED_PATHS = {
        "/api/health",
        "/api/v1/auth/discord",
        "/ws/",
    }

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        for excluded in self.EXCLUDED_PATHS:
            if path.startswith(excluded):
                return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            user_id = self._extract_user_id(token)

            if user_id:
                is_allowed = await rate_limiter.is_allowed(user_id)
                if not is_allowed:
                    raise HTTPException(
                        status_code=429,
                        detail="Too many requests. Please try again later."
                    )

        return await call_next(request)

    def _extract_user_id(self, token: str) -> str | None:
        """Extract user_id from JWT token (simplified)"""
        try:
            import base64
            payload = token.split(".")[1]
            padded = payload + "=" * (4 - len(payload) % 4)
            decoded = base64.b64decode(padded)
            data = eval(decoded)
            return data.get("sub")
        except Exception:
            return None
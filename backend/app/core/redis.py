"""
Redis integration for PUBG Team Finder.
Handles caching, rate limiting, and session management.
"""
import json
import logging
from typing import Optional, Any
from datetime import datetime, timedelta

import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)

REDIS_URL = settings.REDIS_URL
CACHE_TTL_SHORT = 60
CACHE_TTL_MEDIUM = 300
CACHE_TTL_LONG = 3600
CACHE_TTL_DAY = 86400

_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """Get or create Redis client singleton"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


async def close_redis():
    """Close Redis connection"""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None


async def set_cache(key: str, value: Any, ttl: int = CACHE_TTL_MEDIUM) -> bool:
    """Set value in cache with TTL"""
    try:
        client = await get_redis()
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        await client.setex(key, ttl, value)
        return True
    except Exception as e:
        logger.warning(f"Redis SET error for {key}: {e}")
        return False


async def get_cache(key: str) -> Optional[Any]:
    """Get value from cache"""
    try:
        client = await get_redis()
        value = await client.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return None
    except Exception as e:
        logger.warning(f"Redis GET error for {key}: {e}")
        return None


async def delete_cache(key: str) -> bool:
    """Delete key from cache"""
    try:
        client = await get_redis()
        await client.delete(key)
        return True
    except Exception as e:
        logger.warning(f"Redis DEL error for {key}: {e}")
        return False


class RateLimiter:
    """Rate limiting using Redis"""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def is_allowed(self, user_id: str) -> bool:
        """Check if user is within rate limit"""
        try:
            client = await get_redis()
            key = f"rate_limit:{user_id}"

            current = await client.get(key)
            if current is None:
                await client.setex(key, self.window_seconds, 1)
                return True

            count = int(current)
            if count >= self.max_requests:
                return False

            await client.incr(key)
            return True
        except Exception as e:
            logger.warning(f"Rate limit check failed for {user_id}: {e}")
            return True

    async def get_remaining(self, user_id: str) -> int:
        """Get remaining requests for user"""
        try:
            client = await get_redis()
            key = f"rate_limit:{user_id}"
            current = await client.get(key)
            if current is None:
                return self.max_requests
            return max(0, self.max_requests - int(current))
        except Exception:
            return self.max_requests


class SessionManager:
    """User session management in Redis"""

    @staticmethod
    async def set_session(user_id: str, session_data: dict, ttl: int = CACHE_TTL_DAY) -> bool:
        """Set user session data"""
        key = f"user_session:{user_id}"
        session_data["created_at"] = datetime.utcnow().isoformat()
        return await set_cache(key, session_data, ttl)

    @staticmethod
    async def get_session(user_id: str) -> Optional[dict]:
        """Get user session data"""
        key = f"user_session:{user_id}"
        return await get_cache(key)

    @staticmethod
    async def delete_session(user_id: str) -> bool:
        """Delete user session"""
        key = f"user_session:{user_id}"
        return await delete_cache(key)

    @staticmethod
    async def refresh_session(user_id: str, ttl: int = CACHE_TTL_DAY) -> bool:
        """Refresh session TTL"""
        try:
            client = await get_redis()
            key = f"user_session:{user_id}"
            return await client.expire(key, ttl)
        except Exception as e:
            logger.warning(f"Session refresh failed for {user_id}: {e}")
            return False


class PlayerStatsCache:
    """Player statistics caching"""

    @staticmethod
    async def set_stats(player_id: str, stats: dict, ttl: int = CACHE_TTL_LONG) -> bool:
        """Cache player stats with TTL"""
        key = f"player_stats:{player_id}"
        stats["cached_at"] = datetime.utcnow().isoformat()
        return await set_cache(key, stats, ttl)

    @staticmethod
    async def get_stats(player_id: str) -> Optional[dict]:
        """Get cached player stats"""
        key = f"player_stats:{player_id}"
        return await get_cache(key)

    @staticmethod
    async def invalidate_stats(player_id: str) -> bool:
        """Invalidate player stats cache"""
        key = f"player_stats:{player_id}"
        return await delete_cache(key)


class MatchCache:
    """Match data caching"""

    @staticmethod
    async def set_match(match_id: str, match_data: dict, ttl: int = CACHE_TTL_MEDIUM) -> bool:
        """Cache match data"""
        key = f"match_cache:{match_id}"
        return await set_cache(key, match_data, ttl)

    @staticmethod
    async def get_match(match_id: str) -> Optional[dict]:
        """Get cached match data"""
        key = f"match_cache:{match_id}"
        return await get_cache(key)

    @staticmethod
    async def invalidate_match(match_id: str) -> bool:
        """Invalidate match cache"""
        key = f"match_cache:{match_id}"
        return await delete_cache(key)


rate_limiter = RateLimiter()
session_manager = SessionManager()
player_stats_cache = PlayerStatsCache()
match_cache = MatchCache()
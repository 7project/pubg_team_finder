import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import WebSocket


class TestDiscordService:
    def test_register_notification_socket(self):
        from app.services.discord_service import register_notification_socket, active_notifications
        import asyncio

        websocket = MagicMock(spec=WebSocket)
        user_id = "test_user_123"

        async def run_test():
            await register_notification_socket(user_id, websocket)
            assert user_id in active_notifications
            assert active_notifications[user_id] == websocket

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_unregister_notification_socket(self):
        from app.services.discord_service import (
            register_notification_socket,
            unregister_notification_socket,
            active_notifications
        )
        import asyncio

        websocket = MagicMock(spec=WebSocket)
        user_id = "test_user_456"

        async def run_test():
            await register_notification_socket(user_id, websocket)
            assert user_id in active_notifications

            await unregister_notification_socket(user_id)
            assert user_id not in active_notifications

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_send_notification_success(self):
        from app.services.discord_service import register_notification_socket, send_notification, active_notifications
        import asyncio

        websocket = MagicMock(spec=WebSocket)
        websocket.send_json = AsyncMock()
        user_id = "test_user_789"

        async def run_test():
            await register_notification_socket(user_id, websocket)

            message = {"event": "test", "data": "hello"}
            await send_notification(user_id, message)

            websocket.send_json.assert_called_once_with(message)

        asyncio.get_event_loop().run_until_complete(run_test())

    def test_send_notification_user_not_found(self):
        from app.services.discord_service import send_notification
        import asyncio

        async def run_test():
            message = {"event": "test"}
            result = await send_notification("nonexistent_user", message)
            assert result is None

        asyncio.get_event_loop().run_until_complete(run_test())
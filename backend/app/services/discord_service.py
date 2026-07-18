"""
Discord service for managing voice channels and invite links.
Uses Discord Bot Token from environment variables.
"""
import os
import httpx
from typing import Optional
from fastapi import WebSocket
import asyncio

# Store active WebSocket connections for notifications
active_notifications: dict[str, WebSocket] = {}
_lock = asyncio.Lock()

async def register_notification_socket(user_id: str, websocket: WebSocket):
    """Register a WebSocket connection for user notifications"""
    async with _lock:
        active_notifications[user_id] = websocket
        print(f"Registered notification socket for user {user_id}")

async def unregister_notification_socket(user_id: str):
    """Unregister a WebSocket connection"""
    async with _lock:
        if user_id in active_notifications:
            del active_notifications[user_id]
            print(f"Unregistered notification socket for user {user_id}")


async def send_notification(user_id: str, message: dict):
    """Send a notification to a user via WebSocket"""
    if user_id in active_notifications:
        try:
            await active_notifications[user_id].send_json(message)
        except Exception as e:
            print(f"Error sending notification to {user_id}: {e}")
            await unregister_notification_socket(user_id)

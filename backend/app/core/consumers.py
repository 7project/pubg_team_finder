"""
Kafka consumers for PUBG Team Finder.
Handles events from Kafka topics and sends notifications via WebSocket.
"""
import json
import asyncio
import logging
from typing import Optional, Set
from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = "kafka:9092"

WS_MANAGER: Optional['WebSocketManager'] = None


class WebSocketManager:
    """Manages WebSocket connections for real-time notifications"""

    def __init__(self):
        self.active_connections: dict[str, Set] = {}

    def register(self, user_id: str, connection):
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(connection)

    def unregister(self, user_id: str, connection):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(connection)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send WebSocket message to {user_id}: {e}")

    async def broadcast(self, message: dict):
        for user_id in self.active_connections:
            await self.send_to_user(user_id, message)


ws_manager = WebSocketManager()


class NotificationConsumer:
    """Kafka consumer for notifications topic"""

    def __init__(self):
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.running = False

    async def start(self):
        self.consumer = AIOKafkaConsumer(
            "match_invites",
            "match_events",
            "notifications",
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id="backend_notifications",
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest'
        )
        await self.consumer.start()
        self.running = True
        logger.info("Notification consumer started")

    async def stop(self):
        self.running = False
        if self.consumer:
            await self.consumer.stop()

    async def run(self):
        await self.start()
        try:
            async for msg in self.consumer:
                if not self.running:
                    break
                try:
                    await self.handle_message(msg.topic, msg.value)
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
        finally:
            await self.stop()

    async def handle_message(self, topic: str, data: dict):
        """Process notification message and send to WebSocket"""
        logger.info(f"Notification: topic={topic}, data={data}")

        user_id = data.get("user_id") or data.get("invited_user_id")
        if not user_id:
            return

        message = {
            "event_type": data.get("event_type", "notification"),
            "message": data.get("message", ""),
            "match_id": data.get("match_id"),
            "timestamp": data.get("timestamp", ""),
        }

        await ws_manager.send_to_user(str(user_id), message)


class MatchEventsConsumer:
    """Kafka consumer for match events"""

    def __init__(self):
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.running = False

    async def start(self):
        self.consumer = AIOKafkaConsumer(
            "match_created",
            "match_completed",
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id="backend_match_events",
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest'
        )
        await self.consumer.start()
        self.running = True
        logger.info("Match events consumer started")

    async def stop(self):
        self.running = False
        if self.consumer:
            await self.consumer.stop()

    async def run(self):
        await self.start()
        try:
            async for msg in self.consumer:
                if not self.running:
                    break
                try:
                    await self.handle_message(msg.topic, msg.value)
                except Exception as e:
                    logger.error(f"Error handling match event: {e}")
        finally:
            await self.stop()

    async def handle_message(self, topic: str, data: dict):
        """Process match event"""
        logger.info(f"Match event: topic={topic}, match_id={data.get('match_id')}")

        if topic == "match_created":
            await self.handle_match_created(data)
        elif topic == "match_completed":
            await self.handle_match_completed(data)

    async def handle_match_created(self, data: dict):
        """Handle match created event"""
        match_id = data.get("match_id")
        if match_id:
            logger.info(f"Match created: {match_id}")

    async def handle_match_completed(self, data: dict):
        """Handle match completed event"""
        match_id = data.get("match_id")
        if match_id:
            logger.info(f"Match completed: {match_id}")


notification_consumer = NotificationConsumer()
match_events_consumer = MatchEventsConsumer()


async def start_consumers():
    """Start all Kafka consumers"""
    asyncio.create_task(notification_consumer.run())
    asyncio.create_task(match_events_consumer.run())
    logger.info("All Kafka consumers started")


async def stop_consumers():
    """Stop all Kafka consumers"""
    await notification_consumer.stop()
    await match_events_consumer.stop()
    logger.info("All Kafka consumers stopped")
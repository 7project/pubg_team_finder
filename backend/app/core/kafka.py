"""
Kafka integration for PUBG Team Finder.
Handles producing events to Kafka topics.
"""
import os
import json
import asyncio
from typing import Optional, Dict, Any
from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaError

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

# Topics
TOPIC_MATCH_INVITES = "match_invites"
TOPIC_MATCH_EVENTS = "match_events"

# Global producer instance
_producer: Optional[AIOKafkaProducer] = None


async def get_kafka_producer() -> AIOKafkaProducer:
    """Get or create Kafka producer singleton"""
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None,
        )
        await _producer.start()
    return _producer


async def stop_kafka_producer():
    """Stop Kafka producer"""
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None


async def send_match_invite(
    match_id: str,
    user_id: str,
    invited_by: str,
    invited_user_id: str
) -> bool:
    """
    Send match invite event to Kafka.
    Returns True if successful.
    """
    try:
        producer = await get_kafka_producer()
        message = {
            "event_type": "match_invite_sent",
            "match_id": match_id,
            "user_id": user_id,
            "invited_by": invited_by,
            "invited_user_id": invited_user_id,
            "timestamp": asyncio.get_event_loop().time(),
        }
        await producer.send_and_wait(TOPIC_MATCH_INVITES, message, key=invited_user_id)
        print(f"Kafka: Sent invite event for match {match_id} to {invited_user_id}")
        return True
    except KafkaError as e:
        print(f"Kafka error sending invite: {e}")
        return False
    except Exception as e:
        print(f"Error sending invite to Kafka: {e}")
        return False


async def send_match_event(
    event_type: str,
    match_id: str,
    user_id: str,
    **kwargs
) -> bool:
    """
    Send match event to Kafka.
    Returns True if successful.
    """
    try:
        producer = await get_kafka_producer()
        message = {
            "event_type": event_type,
            "match_id": match_id,
            "user_id": user_id,
            "timestamp": asyncio.get_event_loop().time(),
            **kwargs,
        }
        await producer.send_and_wait(TOPIC_MATCH_EVENTS, message, key=user_id)
        print(f"Kafka: Sent event {event_type} for match {match_id}")
        return True
    except KafkaError as e:
        print(f"Kafka error sending event: {e}")
        return False
    except Exception as e:
        print(f"Error sending event to Kafka: {e}")
        return False


# Convenience functions for specific events
async def send_match_created(match_id: str, user_id: str, match_type: str, max_players: int):
    return await send_match_event(
        "match_created",
        match_id,
        user_id,
        match_type=match_type,
        max_players=max_players
    )


async def send_invite_accepted(match_id: str, user_id: str):
    return await send_match_event(
        "invite_accepted",
        match_id,
        user_id
    )


async def send_match_left(match_id: str, user_id: str):
    return await send_match_event(
        "match_left",
        match_id,
        user_id
    )


async def send_match_completed(match_id: str, user_id: str):
    return await send_match_event(
        "match_completed",
        match_id,
        user_id
    )

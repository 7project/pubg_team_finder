import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any

import redis.asyncio as redis
from aiokafka import AIOKafkaConsumer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
CACHE_TTL = 3600
MOCK_STATS = {
    "rank": "Diamond",
    "rank_tier": "Diamond IV",
    "kda": 3.5,
    "win_rate": 52.3,
    "games_played": 150,
    "kills": 2500,
    "deaths": 714,
    "assists": 1200,
    "top_ratio": 15.2,
    "avg_damage": 280.5,
    "last_updated": datetime.now().isoformat()
}

class RedisCache:
    def __init__(self, url: str):
        self.redis = redis.from_url(url, decode_responses=True)

    async def get(self, key: str) -> dict | None:
        try:
            data = await self.redis.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.warning(f"Redis GET error for {key}: {e}")
            return None

    async def set(self, key: str, value: dict, ttl: int = CACHE_TTL) -> bool:
        try:
            await self.redis.setex(key, ttl, json.dumps(value))
            return True
        except Exception as e:
            logger.warning(f"Redis SET error for {key}: {e}")
            return False

    async def close(self):
        await self.redis.close()


class OpggScraper:
    def __init__(self, cache: RedisCache):
        self.cache = cache
        self.request_count = 0

    async def scrape_player_stats(self, player_id: str, username: str) -> dict:
        cache_key = f"player_stats:{player_id}"
        cached = await self.cache.get(cache_key)
        if cached:
            logger.info(f"Cache hit for {username} ({player_id})")
            return cached

        logger.info(f"Scraping op.gg for {username} ({player_id})")
        self.request_count += 1

        await asyncio.sleep(1)

        stats = MOCK_STATS.copy()
        stats["username"] = username
        stats["player_id"] = player_id
        stats["last_updated"] = datetime.now().isoformat()

        await self.cache.set(cache_key, stats)
        return stats

    async def scrape_match_players(self, match_id: str, player_ids: list[tuple[str, str]]) -> dict:
        results = []
        for player_id, username in player_ids:
            stats = await self.scrape_player_stats(player_id, username)
            results.append(stats)

        match_cache_key = f"match_stats:{match_id}"
        match_data = {
            "match_id": match_id,
            "players": results,
            "scraped_at": datetime.now().isoformat()
        }
        await self.cache.set(match_cache_key, match_data, ttl=300)
        return match_data


class KafkaConsumer:
    def __init__(self, topics: list[str], group_id: str):
        self.topics = topics
        self.group_id = group_id
        self.consumer = None

    async def start(self, handler):
        self.consumer = AIOKafkaConsumer(
            *self.topics,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=self.group_id,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='earliest'
        )
        await self.consumer.start()
        logger.info(f"Kafka consumer started for topics: {self.topics}")

        try:
            async for msg in self.consumer:
                try:
                    logger.info(f"Received message: topic={msg.topic} key={msg.key}")
                    await handler(msg.topic, msg.value)
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
        finally:
            await self.consumer.stop()

    async def send(self, topic: str, message: dict):
        from aiokafka import AIOKafkaProducer
        producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        await producer.start()
        try:
            await producer.send_and_wait(topic, message)
        finally:
            await producer.stop()


async def handle_match_created(topic: str, data: dict):
    logger.info(f"Processing match_created: {data}")
    match_id = data.get("match_id")
    players = data.get("players", [])

    if not match_id or not players:
        logger.warning(f"Invalid match_created message: {data}")
        return

    player_ids = [(p.get("player_id", str(i)), p.get("username", f"player_{i}")) for i, p in enumerate(players)]
    result = await scraper.scrape_match_players(match_id, player_ids)
    logger.info(f"Match stats scraped: {len(result['players'])} players")


async def main():
    global scraper
    cache = RedisCache(REDIS_URL)
    scraper = OpggScraper(cache)

    consumer = KafkaConsumer(
        topics=["match_created"],
        group_id="parser_worker"
    )

    logger.info("Starting parser worker...")
    await consumer.start(handle_match_created)


if __name__ == "__main__":
    scraper = None
    asyncio.run(main())
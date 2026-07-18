import asyncio
import json
import logging
import os
from datetime import datetime

import discord
from aiokafka import AIOKafkaConsumer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
DISCORD_GUILD_ID = os.getenv("DISCORD_GUILD_ID", "")
DISCORD_CATEGORY_ID = os.getenv("DISCORD_CATEGORY_ID", "")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

MOCK_CHANNEL_ID = "1234567890"


class DiscordBot:
    def __init__(self, token: str, guild_id: str, category_id: str):
        self.token = token
        self.guild_id = guild_id
        self.category_id = category_id
        self.client = None
        self.active_channels = {}

    async def start(self):
        intents = discord.Intents.default()
        intents.message_content = True
        self.client = discord.Client(intents=intents)

        @self.client.event
        async def on_ready():
            logger.info(f"Discord bot logged in as {self.client.user}")

        await self.client.start(self.token)

    async def create_match_channel(self, match_id: str, match_name: str = None) -> str:
        if not self.client or not self.client.is_ready():
            logger.warning("Discord client not ready, returning mock channel ID")
            return MOCK_CHANNEL_ID

        try:
            guild = self.client.get_guild(int(self.guild_id))
            if not guild:
                logger.warning(f"Guild {self.guild_id} not found")
                return MOCK_CHANNEL_ID

            category = guild.get_channel(int(self.category_id)) if self.category_id else None

            channel_name = match_name or f"Match {match_id[:8]}"
            channel = await guild.create_voice_channel(
                channel_name,
                category=category
            )

            self.active_channels[match_id] = channel.id
            logger.info(f"Created channel {channel.name} ({channel.id}) for match {match_id}")
            return str(channel.id)

        except discord.DiscordException as e:
            logger.error(f"Discord API error creating channel: {e}")
            return MOCK_CHANNEL_ID

    async def delete_match_channel(self, match_id: str) -> bool:
        channel_id = self.active_channels.get(match_id)

        if not channel_id:
            logger.warning(f"No active channel found for match {match_id}")
            return False

        if not self.client or not self.client.is_ready():
            logger.warning("Discord client not ready")
            return False

        try:
            channel = self.client.get_channel(int(channel_id))
            if channel:
                await channel.delete()
                del self.active_channels[match_id]
                logger.info(f"Deleted channel for match {match_id}")
                return True
            return False

        except discord.DiscordException as e:
            logger.error(f"Discord API error deleting channel: {e}")
            return False


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


async def handle_match_created(topic: str, data: dict):
    logger.info(f"Processing match_created: {data}")
    match_id = data.get("match_id")
    match_name = data.get("match_name", f"Match {match_id[:8]}")

    channel_id = await bot.create_match_channel(match_id, match_name)
    logger.info(f"Created channel {channel_id} for match {match_id}")


async def handle_match_completed(topic: str, data: dict):
    logger.info(f"Processing match_completed: {data}")
    match_id = data.get("match_id")

    success = await bot.delete_match_channel(match_id)
    if success:
        logger.info(f"Deleted channel for completed match {match_id}")


async def main():
    global bot

    if not DISCORD_BOT_TOKEN:
        logger.warning("DISCORD_BOT_TOKEN not set, running in mock mode")

    bot = DiscordBot(DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_CATEGORY_ID)

    if DISCORD_BOT_TOKEN and DISCORD_BOT_TOKEN != "your_bot_token_here":
        asyncio.create_task(bot.start())
        await asyncio.sleep(5)
    else:
        logger.info("Running in mock mode (no Discord token)")

    consumer = KafkaConsumer(
        topics=["match_created", "match_completed"],
        group_id="discord_bot"
    )

    logger.info("Starting Discord bot worker...")
    await consumer.start(lambda t, d: (
        handle_match_created(t, d) if t == "match_created" else handle_match_completed(t, d)
    ))


if __name__ == "__main__":
    bot = None
    asyncio.run(main())
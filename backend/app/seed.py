import asyncio
from uuid import uuid4
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import (
    Base, User, UserStatus, PrivacySetting, 
    Match, MatchStatus, MatchType, MatchParticipant, MatchParticipantStatus,
    Rating, ActivityLevel, Group, GroupMember
)
from app.core.config import settings

ASYNC_DB_URL = settings.DATABASE_URL
engine = create_async_engine(ASYNC_DB_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def seed_users(session: AsyncSession):
    users_data = [
        {
            "discord_id": "123456789012345678",
            "username": "SouthUral",
            "display_name": "SouthUral",
            "internal_name": "southural12345678",
            "pubg_nickname": "SouthUralPLAY",
            "pubg_rank": "Diamond",
            "avatar_url": "https://cdn.discordapp.com/embed/avatars/0.png",
            "privacy_setting": PrivacySetting.PUBLIC,
            "status": UserStatus.ACTIVE,
        },
        {
            "discord_id": "234567890123456789",
            "username": "ProGamer",
            "display_name": "ProGamer",
            "internal_name": "progamer23456789",
            "pubg_nickname": "ProGamerTOP",
            "pubg_rank": "Master",
            "avatar_url": "https://cdn.discordapp.com/embed/avatars/1.png",
            "privacy_setting": PrivacySetting.PUBLIC,
            "status": UserStatus.ACTIVE,
        },
        {
            "discord_id": "345678901234567890",
            "username": "SniperWolf",
            "display_name": "Sniper",
            "internal_name": "sniperwolf34567890",
            "pubg_nickname": "WolfSNIPER",
            "pubg_rank": "Diamond",
            "avatar_url": "https://cdn.discordapp.com/embed/avatars/2.png",
            "privacy_setting": PrivacySetting.PUBLIC,
            "status": UserStatus.ACTIVE,
        },
        {
            "discord_id": "456789012345678901",
            "username": "RushB",
            "display_name": "RushB",
            "internal_name": "rushb45678901",
            "pubg_nickname": "RushBDUO",
            "pubg_rank": "Gold",
            "avatar_url": "https://cdn.discordapp.com/embed/avatars/3.png",
            "privacy_setting": PrivacySetting.GROUP_ONLY,
            "status": UserStatus.ACTIVE,
        },
        {
            "discord_id": "567890123456789012",
            "username": "Tactical",
            "display_name": "Tactical",
            "internal_name": "tactical56789012",
            "pubg_nickname": "TacticalSQUAD",
            "pubg_rank": "Platinum",
            "avatar_url": "https://cdn.discordapp.com/embed/avatars/4.png",
            "privacy_setting": PrivacySetting.PUBLIC,
            "status": UserStatus.ACTIVE,
        },
        {
            "discord_id": "678901234567890123",
            "username": "Aggressive",
            "display_name": "Aggressive",
            "internal_name": "aggressive67890123",
            "pubg_nickname": "AGGROLLR",
            "pubg_rank": "Platinum",
            "avatar_url": "https://cdn.discordapp.com/embed/avatars/5.png",
            "privacy_setting": PrivacySetting.NO_INVITES,
            "status": UserStatus.ACTIVE,
        },
    ]

    users = []
    for data in users_data:
        user = User(**data)
        session.add(user)
        users.append(user)
    
    await session.commit()
    print(f"Created {len(users)} users")
    return users


async def seed_matches(session: AsyncSession, users: list):
    matches_data = [
        {
            "created_by": users[0].id,
            "status": MatchStatus.COMPLETED,
            "match_type": MatchType.SQUAD,
            "max_players": 4,
            "discord_invite_link": "https://discord.gg/abc123",
            "completed_at": datetime.utcnow(),
        },
        {
            "created_by": users[1].id,
            "status": MatchStatus.ACTIVE,
            "match_type": MatchType.DUO,
            "max_players": 2,
            "discord_invite_link": "https://discord.gg/def456",
        },
        {
            "created_by": users[2].id,
            "status": MatchStatus.PENDING,
            "match_type": MatchType.SQUAD,
            "max_players": 4,
        },
    ]

    matches = []
    for data in matches_data:
        match = Match(**data)
        session.add(match)
        matches.append(match)
    
    await session.commit()
    print(f"Created {len(matches)} matches")
    return matches


async def seed_participants(session: AsyncSession, matches: list, users: list):
    participants_data = [
        (matches[0].id, users[0].id, MatchParticipantStatus.ACCEPTED, users[1].id, MatchParticipantStatus.ACCEPTED, users[2].id, MatchParticipantStatus.ACCEPTED),
        (matches[1].id, users[1].id, MatchParticipantStatus.ACCEPTED, users[3].id, MatchParticipantStatus.ACCEPTED),
        (matches[2].id, users[2].id, MatchParticipantStatus.ACCEPTED, users[4].id, MatchParticipantStatus.INVITED, users[5].id, MatchParticipantStatus.INVITED),
    ]

    for i, match in enumerate(matches):
        data = participants_data[i]
        idx = 1
        while idx < len(data):
            participant = MatchParticipant(
                match_id=data[0],
                user_id=data[idx],
                status=data[idx + 1],
                invited_at=datetime.utcnow(),
                joined_at=datetime.utcnow() if data[idx + 1] == MatchParticipantStatus.ACCEPTED else None,
            )
            session.add(participant)
            idx += 2
    
    await session.commit()
    print("Created match participants")


async def seed_ratings(session: AsyncSession, matches: list, users: list):
    ratings_data = [
        {
            "match_id": matches[0].id,
            "from_user_id": users[0].id,
            "to_user_id": users[1].id,
            "friendliness": 5,
            "skill": 5,
            "adequacy": 5,
            "character_rating": 5,
            "activity_level": ActivityLevel.ACTIVE,
            "is_inadequate": False,
            "comment": "Great player!",
        },
        {
            "match_id": matches[0].id,
            "from_user_id": users[1].id,
            "to_user_id": users[0].id,
            "friendliness": 4,
            "skill": 5,
            "adequacy": 5,
            "character_rating": 4,
            "activity_level": ActivityLevel.ACTIVE,
            "is_inadequate": False,
        },
    ]

    for data in ratings_data:
        rating = Rating(**data)
        session.add(rating)
    
    await session.commit()
    print(f"Created {len(ratings_data)} ratings")


async def main():
    print("Starting seed...")
    
    async with AsyncSessionLocal() as session:
        users = await seed_users(session)
        matches = await seed_matches(session, users)
        await seed_participants(session, matches, users)
        await seed_ratings(session, matches, users)
    
    print("Seed completed!")


if __name__ == "__main__":
    asyncio.run(main())

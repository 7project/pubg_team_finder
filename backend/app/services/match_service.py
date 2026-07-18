from datetime import datetime
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import (
    User, UserStatus, PrivacySetting,
    Match, MatchStatus, MatchType,
    MatchParticipant, MatchParticipantStatus
)
from app.core.database import get_db
from app.core.kafka import (
    send_match_invite,
    send_match_created,
    send_invite_accepted,
    send_match_completed,
    send_match_left,
)
from app.services.discord_service import send_notification


async def create_match(
    db: AsyncSession,
    creator: User,
    match_type: MatchType = MatchType.SQUAD,
    invited_user_ids: list[UUID] = None,
    max_players: int = None
) -> Match:
    """Создание нового матча"""
    
    # Определяем максимальное количество игроков
    if max_players is None:
        max_players_map = {
            MatchType.SQUAD: 4,
            MatchType.DUO: 2,
            MatchType.CUSTOM: 10,
        }
        max_players = max_players_map.get(match_type, 4)
    
    # Создаем матч
    match = Match(
        created_by=creator.id,
        status=MatchStatus.PENDING,
        match_type=match_type,
        max_players=max_players,
    )
    db.add(match)
    await db.flush()  # Чтобы получить ID матча
    
    # Добавляем создателя как участника (ACCEPTED)
    creator_participant = MatchParticipant(
        match_id=match.id,
        user_id=creator.id,
        status=MatchParticipantStatus.ACCEPTED,
        invited_at=datetime.utcnow(),
        responded_at=datetime.utcnow(),
        joined_at=datetime.utcnow(),
    )
    db.add(creator_participant)
    
    # Приглашаем других игроков
    if invited_user_ids:
        for uid in invited_user_ids:
            if uid != creator.id:  # Не приглашаем создателя повторно
                await invite_player(db, match, uid)
    
    # Kafka: отправляем событие о создании матча
    await send_match_created(
        str(match.id),
        str(creator.id),
        match.match_type.value if hasattr(match.match_type, 'value') else str(match.match_type),
        match.max_players
    )
    
    await db.flush()
    return match


async def invite_player(
    db: AsyncSession,
    match: Match,
    user_id: UUID
) -> MatchParticipant:
    """Пригласить игрока в матч"""
    
    # Проверяем, не занят ли игрок
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError(f"User {user_id} not found")
    
    if user.status == UserStatus.BUSY:
        raise ValueError(f"User {user.username} is currently in a match")
    
    # Проверяем лимит игроков
    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match.id
        )
    )
    current_participants = result.scalars().all()
    if len(current_participants) >= match.max_players:
        raise ValueError(f"Match is full (max {match.max_players} players)")
    
    # Проверяем, не приглашен ли уже игрок
    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match.id,
            MatchParticipant.user_id == user_id
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError(f"User already in match")
    
    # Создаем приглашение
    participant = MatchParticipant(
        match_id=match.id,
        user_id=user_id,
        status=MatchParticipantStatus.INVITED,
        invited_at=datetime.utcnow(),
    )
    db.add(participant)
    await db.flush()

    await send_notification(str(user_id), {
        "event_type": "match_invite_sent",
        "match_id": str(match.id),
        "match_type": match.match_type.value if hasattr(match.match_type, 'value') else str(match.match_type),
        "created_by": str(match.created_by),
        "username": user.username
    })

    await db.commit()
    return participant


async def accept_invite(
    db: AsyncSession,
    match: Match,
    user: User
) -> MatchParticipant:
    """Принять приглашение в матч"""
    
    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match.id,
            MatchParticipant.user_id == user.id
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise ValueError("Invitation not found")
    
    if participant.status != MatchParticipantStatus.INVITED:
        raise ValueError(f"Invitation already {participant.status}")
    
    # Обновляем статус
    participant.status = MatchParticipantStatus.ACCEPTED
    participant.responded_at = datetime.utcnow()
    participant.joined_at = datetime.utcnow()
    
    # Меняем статус пользователя
    user.status = UserStatus.BUSY
    
    # Kafka: отправляем событие о принятии приглашения
    await send_invite_accepted(str(match.id), str(user.id))

    await send_notification(str(match.created_by), {
        "event_type": "invite_accepted",
        "match_id": str(match.id),
        "match_type": match.match_type.value if hasattr(match.match_type, 'value') else str(match.match_type),
        "username": user.username
    })

    await db.commit()
    return participant


async def decline_invite(
    db: AsyncSession,
    match: Match,
    user: User
) -> None:
    """Отклонить приглашение"""
    
    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match.id,
            MatchParticipant.user_id == user.id
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise ValueError("Invitation not found")
    
    participant.status = MatchParticipantStatus.DECLINED
    participant.responded_at = datetime.utcnow()
    
    await db.delete(participant)  # Удаляем отклоненное приглашение
    await db.commit()


async def leave_match(
    db: AsyncSession,
    match: Match,
    user: User
) -> None:
    """Покинуть матч"""
    
    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match.id,
            MatchParticipant.user_id == user.id
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise ValueError("Not a participant of this match")
    
    # Удаляем участника
    await db.delete(participant)
    
    # Меняем статус пользователя
    user.status = UserStatus.ACTIVE
    
    # Kafka: отправляем событие о выходе из матча
    await send_match_left(str(match.id), str(user.id))

    await send_notification(str(match.created_by), {
        "event_type": "match_left",
        "match_id": str(match.id),
        "username": user.username
    })

    # Если матч пустой, меняем статус на CANCELLED
    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match.id
        )
    )
    remaining = result.scalars().all()
    if not remaining:
        match.status = MatchStatus.CANCELLED
    
    await db.commit()


async def remove_participant(
    db: AsyncSession,
    match_id: UUID,
    user_id: UUID
) -> None:
    """Удалить участника из матча. Участник удаляет сам себя."""

    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()

    if not match:
        raise ValueError("Match not found")

    if match.status != MatchStatus.ACTIVE:
        raise ValueError("Cannot leave a completed or cancelled match")

    if match.created_by == user_id:
        raise PermissionError("Match creator cannot leave. Use cancel match instead.")

    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match_id,
            MatchParticipant.user_id == user_id
        )
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise ValueError("You are not a participant of this match")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()

    await db.delete(participant)

    user.status = UserStatus.ACTIVE

    await send_notification(str(match.created_by), {
        "event_type": "match_left",
        "match_id": str(match.id),
        "username": user.username
    })

    result = await db.execute(
        select(MatchParticipant).where(MatchParticipant.match_id == match_id)
    )
    remaining = result.scalars().all()

    if len(remaining) == 0:
        match.status = MatchStatus.CANCELLED

    await db.commit()


async def get_match_participants(
    db: AsyncSession,
    match: Match
) -> list[MatchParticipant]:
    """Получить список участников матча"""
    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match.id
        )
    )
    return result.scalars().all()


async def cancel_match(
    db: AsyncSession,
    match: Match,
    user: User
) -> None:
    """Отменить матч. Только создатель может отменить матч."""
    if match.created_by != user.id:
        raise PermissionError("Only match creator can cancel the match")

    result = await db.execute(
        select(MatchParticipant).where(MatchParticipant.match_id == match.id)
    )
    participants = result.scalars().all()

    for participant in participants:
        if participant.user_id != user.id:
            await send_notification(str(participant.user_id), {
                "event_type": "match_cancelled",
                "match_id": str(match.id),
                "message": "Match has been cancelled by the creator"
            })
            result = await db.execute(select(User).where(User.id == participant.user_id))
            p_user = result.scalar_one_or_none()
            if p_user:
                p_user.status = UserStatus.ACTIVE

    match.status = MatchStatus.CANCELLED
    user.status = UserStatus.ACTIVE
    await db.commit()


async def update_match(
    db: AsyncSession,
    match: Match,
    update_data: "MatchUpdate"
) -> Match:
    """Обновить информацию о матче"""
    if update_data.name is not None:
        pass

    if update_data.discord_channel_id is not None:
        match.discord_channel_id = update_data.discord_channel_id

    if update_data.discord_channel_name is not None:
        pass

    if update_data.discord_invite_link is not None:
        match.discord_invite_link = update_data.discord_invite_link

    if update_data.main_channel is not None:
        pass

    await db.flush()
    return match


async def remove_participant_by_creator(
    db: AsyncSession,
    match: Match,
    target_user_id: UUID,
    creator_id: UUID
) -> None:
    """Удалить участника из матча. Только создатель может удалять."""
    if match.created_by != creator_id:
        raise PermissionError("Only match creator can remove participants")

    if target_user_id == creator_id:
        raise ValueError("Creator cannot remove themselves. Use cancel match instead.")

    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match.id,
            MatchParticipant.user_id == target_user_id
        )
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise ValueError("Participant not found in this match")

    result = await db.execute(select(User).where(User.id == target_user_id))
    user = result.scalar_one_or_none()

    await db.delete(participant)

    if user:
        user.status = UserStatus.ACTIVE

    await send_notification(str(target_user_id), {
        "event_type": "participant_removed",
        "match_id": str(match.id),
        "message": "You have been removed from the match by the creator"
    })

    result = await db.execute(
        select(MatchParticipant).where(MatchParticipant.match_id == match.id)
    )
    remaining = result.scalars().all()

    if len(remaining) == 0:
        match.status = MatchStatus.CANCELLED

    await db.commit()


async def confirm_participation(
    db: AsyncSession,
    match: Match,
    user: User
) -> MatchParticipant:
    """Подтвердить участие в матче"""
    result = await db.execute(
        select(MatchParticipant).where(
            MatchParticipant.match_id == match.id,
            MatchParticipant.user_id == user.id
        )
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise ValueError("You are not a participant of this match")

    if participant.status != MatchParticipantStatus.ACCEPTED:
        raise ValueError(f"Cannot confirm participation with status: {participant.status}")

    participant.is_ready = True

    await send_notification(str(match.created_by), {
        "event_type": "participant_ready",
        "match_id": str(match.id),
        "username": user.username
    })

    await db.commit()
    return participant


async def request_confirmation(
    db: AsyncSession,
    match: Match,
    user: User
) -> None:
    """Запросить подтверждение участия от всех участников"""
    if match.created_by != user.id:
        raise PermissionError("Only match creator can request confirmation")

    result = await db.execute(
        select(MatchParticipant).where(MatchParticipant.match_id == match.id)
    )
    participants = result.scalars().all()

    for participant in participants:
        if participant.user_id != user.id:
            await send_notification(str(participant.user_id), {
                "event_type": "confirmation_requested",
                "match_id": str(match.id),
                "message": "Creator has requested confirmation of your participation"
            })

    await db.commit()

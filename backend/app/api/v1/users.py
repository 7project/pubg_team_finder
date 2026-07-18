from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, PrivacySetting, Rating
from app.schemas.schemas import UserResponse, UserUpdate, UserCreate, PaginatedResponse, PaginationParams, RatingStatsResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field not in ["discord_id", "username"]:
            setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/search/", response_model=list[UserResponse])
async def search_users(
    q: str = None,
    rank: str = None,
    min_rating: float = None,
    group_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    query = select(User).where(User.privacy_setting == PrivacySetting.PUBLIC)
    if q:
        search_term = f"%{q}%"
        query = query.where(
            User.username.ilike(search_term) |
            User.display_name.ilike(search_term) |
            User.pubg_nickname.ilike(search_term)
        )
    if rank:
        query = query.where(User.pubg_rank == rank)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/search/pubg/", response_model=list[UserResponse])
async def search_by_pubg_nickname(
    q: str,
    db: AsyncSession = Depends(get_db)
):
    """Поиск игроков по нику PUBG (можно повторять)"""
    query = select(User).where(
        User.pubg_nickname.ilike(f"%{q}%"),
        User.privacy_setting != PrivacySetting.NO_INVITES
    ).order_by(User.pubg_nickname)
    result = await db.execute(query.limit(20))
    return result.scalars().all()


@router.get("/search/discord/", response_model=list[UserResponse])
async def search_by_discord_username(
    q: str,
    db: AsyncSession = Depends(get_db)
):
    """Поиск игроков по имени Discord (уникальные)"""
    query = select(User).where(
        User.username.ilike(f"%{q}%")
    ).order_by(User.username).limit(20)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/search/paginated", response_model=PaginatedResponse[UserResponse])
async def search_users_paginated(
    q: str = None,
    rank: str = None,
    min_rating: float = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Поиск игроков с пагинацией"""
    params = PaginationParams(page=page, page_size=page_size)
    query = select(User).where(User.privacy_setting == PrivacySetting.PUBLIC)
    count_query = select(func.count(User.id)).where(User.privacy_setting == PrivacySetting.PUBLIC)

    if q:
        search_term = f"%{q}%"
        query = query.where(
            User.username.ilike(search_term) |
            User.display_name.ilike(search_term) |
            User.pubg_nickname.ilike(search_term)
        )
        count_query = count_query.where(
            User.username.ilike(search_term) |
            User.display_name.ilike(search_term) |
            User.pubg_nickname.ilike(search_term)
        )
    if rank:
        query = query.where(User.pubg_rank == rank)
        count_query = count_query.where(User.pubg_rank == rank)

    query = query.offset(params.skip).limit(params.limit)
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedResponse.create(items, total, params)


@router.get("/{user_id}/rating-stats", response_model=RatingStatsResponse)
async def get_user_rating_stats(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Получить статистику рейтинга пользователя"""
    result = await db.execute(
        select(func.avg(Rating.friendliness),
               func.avg(Rating.skill),
               func.avg(Rating.adequacy),
               func.avg(Rating.character_rating),
               func.count(Rating.id))
        .where(Rating.to_user_id == user_id)
    )
    row = result.one_or_none()

    if not row or row[4] == 0:
        return RatingStatsResponse(rating_count=0)

    friendliness_avg, skill_avg, adequacy_avg, character_avg, count = row

    overall_avg = ((friendliness_avg or 0) + (skill_avg or 0) + (adequacy_avg or 0) + (character_avg or 0)) / 4

    return RatingStatsResponse(
        rating_average=round(overall_avg, 2) if overall_avg else None,
        rating_count=count,
        friendliness_avg=round(friendliness_avg, 2) if friendliness_avg else None,
        skill_avg=round(skill_avg, 2) if skill_avg else None,
        adequacy_avg=round(adequacy_avg, 2) if adequacy_avg else None,
        character_avg=round(character_avg, 2) if character_avg else None,
    )
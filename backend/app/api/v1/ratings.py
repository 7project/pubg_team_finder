from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Rating, User
from app.schemas.schemas import RatingCreate, RatingResponse

router = APIRouter()


@router.post("/", response_model=RatingResponse)
async def create_rating(
    rating: RatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime
    new_rating = Rating(
        **rating.model_dump(),
        from_user_id=current_user.id,
        created_at=datetime.utcnow()
    )
    db.add(new_rating)
    await db.commit()
    await db.refresh(new_rating)
    return new_rating


@router.get("/user/{user_id}", response_model=list[RatingResponse])
async def get_user_ratings(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Rating).where(Rating.to_user_id == user_id)
    )
    return result.scalars().all()
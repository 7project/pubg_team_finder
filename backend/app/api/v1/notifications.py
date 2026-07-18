from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Notification, User
from app.schemas.schemas import PaginatedResponse, PaginationParams, NotificationResponse

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[NotificationResponse])
async def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    params = PaginationParams(page=page, page_size=page_size)

    query = select(Notification).where(Notification.user_id == current_user.id)
    count_query = select(func.count(Notification.id)).where(Notification.user_id == current_user.id)

    if unread_only:
        query = query.where(Notification.read == False)
        count_query = count_query.where(Notification.read == False)

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    query = query.order_by(Notification.created_at.desc()).offset(params.skip).limit(params.limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedResponse.create(items, total, params)


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.read = True
    await db.commit()
    return {"success": True, "message": "Notification marked as read"}


@router.post("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read == False)
        .values(read=True)
    )
    await db.commit()
    return {"success": True, "message": "All notifications marked as read"}


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count_result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.read == False
        )
    )
    count = count_result.scalar()
    return {"unread_count": count}

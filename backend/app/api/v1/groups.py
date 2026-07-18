from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Group, GroupMember, User
from app.schemas.schemas import GroupCreate, GroupUpdate, GroupResponse, PaginatedResponse, PaginationParams

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[GroupResponse])
async def get_groups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    params = PaginationParams(page=page, page_size=page_size)

    query = select(Group).options(
        selectinload(Group.members).selectinload(GroupMember.user)
    )
    count_query = select(func.count(Group.id))

    if search:
        search_term = f"%{search}%"
        query = query.where(Group.name.ilike(search_term))
        count_query = count_query.where(Group.name.ilike(search_term))

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    query = query.order_by(Group.created_at.desc()).offset(params.skip).limit(params.limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedResponse.create(items, total, params)


@router.post("/", response_model=GroupResponse)
async def create_group(
    group: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_group = Group(**group.model_dump(), owner_id=current_user.id)
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)
    return new_group


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Group).where(Group.id == group_id).options(
            selectinload(Group.members).selectinload(GroupMember.user)
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: UUID,
    group_update: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = group_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/{group_id}")
async def delete_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(group)
    await db.commit()
    return {"message": "Group deleted"}


@router.post("/{group_id}/members")
async def add_member(
    group_id: UUID,
    user_id: UUID = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    membership = GroupMember(group_id=group_id, user_id=user_id)
    db.add(membership)
    await db.commit()
    return {"message": "Member added"}


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(membership)
    await db.commit()
    return {"message": "Member removed"}
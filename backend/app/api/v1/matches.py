from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Match, MatchParticipant, MatchStatus, User, MatchType, GroupMember
from app.schemas.schemas import (
    MatchCreate, MatchResponse, MatchSuggestionResponse,
    PaginatedResponse, PaginationParams, MatchUpdate
)
from app.services.match_service import (
    create_match as create_match_service,
    invite_player,
    accept_invite as accept_invite_service,
    leave_match as leave_match_service,
    remove_participant,
    cancel_match as cancel_match_service,
    update_match as update_match_service,
    remove_participant_by_creator,
    confirm_participation,
    request_confirmation,
)

router = APIRouter()


@router.get("/suggestions", response_model=MatchSuggestionResponse)
async def get_suggestions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    group_ids_result = await db.execute(
        select(GroupMember.group_id).where(GroupMember.user_id == current_user.id)
    )
    group_ids = [row[0] for row in group_ids_result.fetchall()]

    from_group_ids = set()
    if group_ids:
        from_group_result = await db.execute(
            select(GroupMember.user_id).where(
                GroupMember.group_id.in_(group_ids),
                GroupMember.user_id != current_user.id
            )
        )
        from_group_ids = {row[0] for row in from_group_result.fetchall()}

    base_query = select(User).where(
        User.privacy_setting != "NO_INVITES",
        User.status != "BUSY"
    )

    result = await db.execute(base_query.order_by(User.created_at.desc()).limit(50))
    all_users = result.scalars().all()

    from_group = [u for u in all_users if u.id in from_group_ids]
    other_users = [u for u in all_users if u.id not in from_group_ids]

    return MatchSuggestionResponse(users=other_users[:20], from_group=from_group[:10])


@router.post("/", response_model=MatchResponse)
async def create_match(
    match: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        new_match = await create_match_service(
            db=db,
            creator=current_user,
            match_type=MatchType(match.match_type) if match.match_type else MatchType.SQUAD,
            max_players=match.max_players,
            invited_user_ids=match.invited_user_ids or None,
        )
        await db.commit()
        result = await db.execute(
            select(Match).where(Match.id == new_match.id).options(
                selectinload(Match.participants).selectinload(MatchParticipant.user)
            )
        )
        return result.scalar_one()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{match_id}", response_model=MatchResponse)
async def get_match(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Match).where(Match.id == match_id).options(
            selectinload(Match.participants).selectinload(MatchParticipant.user)
        )
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.post("/{match_id}/complete")
async def complete_match(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    match.status = MatchStatus.COMPLETED
    match.completed_at = datetime.utcnow()
    await db.commit()
    return {"message": "Match completed"}


@router.post("/{match_id}/invite/{user_id}")
async def invite_player(
    match_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Проверяем права (только создатель может приглашать)
    if match.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only match creator can invite")
    
    try:
        await invite_player(db, match, user_id)
        return {"message": "Invite sent"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{match_id}/accept")
async def accept_invite(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    try:
        await accept_invite_service(db, match, current_user)
        return {"message": "Invite accepted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{match_id}/leave")
async def leave_match(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    try:
        await leave_match_service(db, match, current_user)
        return {"message": "Left match"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{match_id}/remove-my-participation")
async def remove_my_participation(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        await remove_participant(db, match_id, current_user.id)
        return {"success": True, "message": "You have left the match"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/", response_model=PaginatedResponse[MatchResponse])
async def list_my_matches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import MatchParticipant
    from sqlalchemy import func
    from app.schemas.schemas import MatchResponse

    params = PaginationParams(page=page, page_size=page_size)

    base_query = select(Match).join(MatchParticipant).where(MatchParticipant.user_id == current_user.id)
    count_query = select(func.count()).select_from(Match).join(MatchParticipant).where(MatchParticipant.user_id == current_user.id)

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    result = await db.execute(
        base_query
        .options(
            selectinload(Match.participants).selectinload(MatchParticipant.user)
        )
        .order_by(Match.created_at.desc())
        .offset(params.skip)
        .limit(params.limit)
    )
    matches = result.scalars().all()

    match_responses = [MatchResponse.model_validate(m) for m in matches]
    return PaginatedResponse.create(match_responses, total, params)


@router.delete("/{match_id}")
async def cancel_match(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only match creator can cancel the match")

    try:
        await cancel_match_service(db, match, current_user)
        return {"success": True, "message": "Match cancelled"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{match_id}", response_model=MatchResponse)
async def update_match(
    match_id: UUID,
    match_update: MatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only match creator can update the match")

    try:
        updated_match = await update_match_service(db, match, match_update)
        await db.commit()
        result = await db.execute(
            select(Match).where(Match.id == match_id).options(
                selectinload(Match.participants).selectinload(MatchParticipant.user)
            )
        )
        return result.scalar_one()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{match_id}/participants/{user_id}")
async def remove_participant_by_creator(
    match_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only match creator can remove participants")

    try:
        await remove_participant_by_creator(db, match, user_id, current_user.id)
        return {"success": True, "message": "Participant removed"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{match_id}/request-confirmation")
async def request_match_confirmation(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only match creator can request confirmation")

    try:
        await request_confirmation(db, match, current_user)
        return {"success": True, "message": "Confirmation requested"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{match_id}/confirm")
async def confirm_match_participation(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    try:
        await confirm_participation(db, match, current_user)
        return {"success": True, "message": "Participation confirmed"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
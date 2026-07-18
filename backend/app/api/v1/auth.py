from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
import uuid
import logging
import time

from app.core.database import get_db
from app.core.config import settings
from app.models.models import User, MatchStatus
from app.schemas.schemas import TokenResponse, UserResponse
from app.core.security import create_access_token, create_refresh_token, get_current_user

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter(tags=["auth"])

DISCORD_CLIENT_ID = settings.DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET = settings.DISCORD_CLIENT_SECRET
DISCORD_REDIRECT_URI = settings.DISCORD_REDIRECT_URI if settings.DISCORD_REDIRECT_URI else "http://localhost:3000/api/auth/callback"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_USER_URL = "https://discord.com/api/users/@me"

used_codes: dict = {}
CODE_CACHE_TTL = 300

logger.info(f"DISCORD_CLIENT_ID: {DISCORD_CLIENT_ID[:10]}..." if DISCORD_CLIENT_ID else "DISCORD_CLIENT_ID: None")
logger.info(f"DISCORD_CLIENT_SECRET set: {bool(DISCORD_CLIENT_SECRET)}")
logger.info(f"DISCORD_REDIRECT_URI: {DISCORD_REDIRECT_URI}")


@router.get("/discord")
async def discord_login():
    """Начало OAuth авторизации через Discord"""
    discord_auth_url = (
        f"https://discord.com/oauth2/authorize?"
        f"client_id={DISCORD_CLIENT_ID}&"
        f"redirect_uri={DISCORD_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=identify%20email"
    )
    
    logger.info("=== DISCORD OAUTH START ===")
    logger.info(f"DISCORD_REDIRECT_URI used: {DISCORD_REDIRECT_URI}")
    logger.info(f"Full OAuth URL: {discord_auth_url}")
    logger.info("============================")
    
    return RedirectResponse(discord_auth_url)


@router.get("/discord/callback")
async def discord_callback(
    code: str, 
    db: AsyncSession = Depends(get_db)
):
    """Обработка callback от Discord"""
    
    if DISCORD_CLIENT_SECRET == "your_discord_client_secret_here" or not DISCORD_CLIENT_SECRET:
        return {"error": "Discord OAuth не настроен. Добавьте DISCORD_CLIENT_SECRET в .env файл.", "setup_required": True}
    
    current_time = time.time()
    for k, v in list(used_codes.items()):
        if current_time - v[0] > CODE_CACHE_TTL:
            del used_codes[k]
    
    if code in used_codes:
        logger.info(f"Code already used, returning cached user")
        cached = used_codes[code][1]
        return {
            "access_token": cached["access_token"],
            "refresh_token": cached["refresh_token"],
            "token_type": "bearer",
            "user": cached["user"]
        }
    
    logger.info(f"=== DISCORD CALLBACK STARTED ===")
    logger.info(f"Code received: {code[:20]}..." if code else "No code")
    logger.info(f"Redirect URI being sent: {DISCORD_REDIRECT_URI}")
    
    try:
        async with httpx.AsyncClient() as client:
            logger.info("Sending token request to Discord...")
            token_response = await client.post(
                DISCORD_TOKEN_URL,
                data={
                    "client_id": DISCORD_CLIENT_ID,
                    "client_secret": DISCORD_CLIENT_SECRET,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": DISCORD_REDIRECT_URI,
                }
            )
            
            logger.info(f"Token response status: {token_response.status_code}")
            logger.info(f"Token response body: {token_response.text[:500]}")
            
            if token_response.status_code != 200:
                error_detail = token_response.text
                logger.error(f"Token exchange failed: {error_detail}")
                return {"error": f"Token exchange failed: {error_detail}", "code_used": True}
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                logger.error("No access token in response")
                return {"error": "No access token in response"}
            
            logger.info("Getting user info from Discord...")
            user_response = await client.get(
                DISCORD_USER_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            logger.info(f"User response status: {user_response.status_code}")
            
            if user_response.status_code != 200:
                logger.error(f"Failed to get user info: {user_response.text}")
                return {"error": "Failed to get user info"}
            
            discord_user = user_response.json()
            logger.info(f"Discord user: {discord_user.get('username')} ({discord_user.get('id')})")
    except Exception as e:
        logger.exception(f"Exception in callback: {e}")
        return {"error": str(e)}
    
    discord_id = str(discord_user["id"])
    discord_username = discord_user["username"]
    avatar_hash = discord_user.get("avatar")
    
    avatar_url = (
        f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar_hash}.png"
        if avatar_hash
        else f"https://cdn.discordapp.com/embed/avatars/{int(discord_user.get('discriminator', 0)) % 5}.png"
    )
    
    result = await db.execute(select(User).where(User.discord_id == discord_id))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        existing_user.username = discord_username
        existing_user.avatar_url = avatar_url
        await db.commit()
        
        access_token_jwt = create_access_token(data={"sub": str(existing_user.id)})
        refresh_token = create_refresh_token(data={"sub": str(existing_user.id)})
        
        user_data = {
            "access_token": access_token_jwt,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": str(existing_user.id),
                "discordUsername": existing_user.username,
                "displayName": existing_user.display_name or existing_user.username,
                "pubgNickname": existing_user.pubg_nickname or existing_user.username,
                "avatarUrl": existing_user.avatar_url,
            }
        }
        used_codes[code] = (time.time(), user_data)
        return user_data
    
    internal_name = f"{discord_username.lower()}_{discord_id[:8]}"
    
    base_internal_name = internal_name
    counter = 1
    while True:
        result = await db.execute(
            select(User).where(User.internal_name == internal_name)
        )
        if not result.scalar_one_or_none():
            break
        internal_name = f"{base_internal_name}_{counter}"
        counter += 1
    
    new_user = User(
        discord_id=discord_id,
        username=discord_username,
        display_name=discord_username,
        internal_name=internal_name,
        avatar_url=avatar_url,
        pubg_nickname=discord_username,
        privacy_setting="PUBLIC",
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    access_token_jwt = create_access_token(data={"sub": str(new_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(new_user.id)})
    
    user_data = {
        "access_token": access_token_jwt,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(new_user.id),
            "discordUsername": new_user.username,
            "displayName": new_user.display_name,
            "pubgNickname": new_user.pubg_nickname,
            "avatarUrl": new_user.avatar_url,
        }
    }
    used_codes[code] = (time.time(), user_data)
    return user_data


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Обновление токена"""
    from app.core.security import verify_token
    
    try:
        payload = verify_token(refresh_token)
        user_id = payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer"
    )


@router.post("/logout")
async def logout():
    """Выход из системы"""
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получение информации о текущем пользователе с Discord ссылкой"""
    from app.models.models import MatchParticipant, Match, MatchStatus
    
    active_match = None
    try:
        result = await db.execute(
            select(Match)
            .join(MatchParticipant)
            .where(
                MatchParticipant.user_id == current_user.id,
                MatchParticipant.status == "ACCEPTED",
                Match.status.in_([MatchStatus.ACTIVE, MatchStatus.PENDING])
            )
        )
        active_match = result.scalar_one_or_none()
    except Exception as e:
        logger.error(f"Error fetching active match for user {current_user.id}: {e}")
    
    # Добавляем Discord ссылку в ответ если есть активный матч
    user_dict = {
        "id": str(current_user.id),
        "discord_id": current_user.discord_id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "internal_name": current_user.internal_name,
        "avatar_url": current_user.avatar_url,
        "pubg_nickname": current_user.pubg_nickname,
        "pubg_rank": current_user.pubg_rank,
        "tiktok_link": current_user.tiktok_link,
        "youtube_shorts_link": current_user.youtube_shorts_link,
        "privacy_setting": current_user.privacy_setting,
        "status": current_user.status,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "discord_invite_link": active_match.discord_invite_link if active_match else None,
    }
    
    return user_dict

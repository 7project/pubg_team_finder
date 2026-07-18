from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter()


@router.get("/player/{op_gg_username}")
async def parse_player(op_gg_username: str):
    return {
        "op_gg_identifier": op_gg_username,
        "rank_tier": "Gold",
        "kd_ratio": 1.5,
        "wins": 10,
        "games_played": 100,
        "avg_damage": 150.5
    }
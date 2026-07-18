from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
import time

from contextlib import asynccontextmanager

from app.api.v1 import auth, users, groups, matches, ratings, parser, notifications
from app.core.config import settings
from app.core.database import engine
from app.core.redis import close_redis
from app.core.kafka import stop_kafka_producer
from app.core.consumers import start_consumers, stop_consumers
from app.services.discord_service import register_notification_socket, unregister_notification_socket

from typing import Dict, Optional

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PUBG Team Finder API...")
    try:
        await start_consumers()
        logger.info("Kafka consumers started")
    except Exception as e:
        logger.warning(f"Failed to start Kafka consumers: {e}")
    yield
    logger.info("Shutting down...")
    try:
        await stop_consumers()
    except Exception as e:
        logger.warning(f"Error stopping consumers: {e}")
    await close_redis()
    await stop_kafka_producer()


def get_application() -> FastAPI:
    application = FastAPI(
        title="PUBG Team Finder API",
        description="API for finding PUBG teammates by rank",
        version="1.0.0",
        lifespan=lifespan,
    )

    @application.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        
        logger.info(f"→ {request.method} {request.url.path} | Query: {request.url.query}")
        
        response = await call_next(request)
        
        duration = time.time() - start_time
        logger.info(f"← {request.method} {request.url.path} | Status: {response.status_code} | Duration: {duration:.3f}s")
        
        return response

    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost",
            "http://localhost:80",
            "http://localhost:3000",
            "http://frontend:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
    application.include_router(users.router, prefix="/api/v1/users", tags=["users"])
    application.include_router(groups.router, prefix="/api/v1/groups", tags=["groups"])
    application.include_router(matches.router, prefix="/api/v1/matches", tags=["matches"])
    application.include_router(ratings.router, prefix="/api/v1/ratings", tags=["ratings"])
    application.include_router(parser.router, prefix="/api/v1/parser", tags=["parser"])
    application.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])

    @application.get("/health")
    async def health_check():
        return {"status": "healthy"}

    @application.websocket("/ws/notifications/{user_id}")
    async def websocket_notifications(websocket: WebSocket, user_id: str):
        await websocket.accept()
        await register_notification_socket(user_id, websocket)
        print(f"WebSocket connected for user {user_id}")
        try:
            while True:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text('{"type": "pong"}')
        except WebSocketDisconnect:
            print(f"WebSocket disconnected for user {user_id}")
        except Exception as e:
            print(f"WebSocket error for {user_id}: {e}")
        finally:
            await unregister_notification_socket(user_id)

    return application


app = get_application()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
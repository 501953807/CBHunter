import os
import sys
import logging

# Make sure our app loggers output at INFO level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    force=True,
)

from contextlib import asynccontextmanager

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.database import init_db, async_session
from app.api.router import api_router
from app.tasks.scheduler import setup_scheduler, scheduler as app_scheduler
from app.api.v1.health import router as health_router
from app.services.provider_service import seed_providers
from app.services.sys_dict_service import seed_sys_dict
from app.exceptions import register_exception_handlers

logger = logging.getLogger(__name__)

MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests with body exceeding MAX_BODY_SIZE before processing."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_BODY_SIZE:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "请求体过大，最大允许 10 MB"},
                    )
            except ValueError:
                logger.debug("Ignoring invalid Content-Length header: %r", content_length)
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Load Gemini API Key from system_config (if DB has it, .env fallback)
    async with async_session() as db:
        await seed_providers(db)
        await seed_sys_dict(db)
        try:
            from app.models.system_config import SystemConfig
            from app.utils.encryption import decrypt
            from sqlalchemy import select
            result = await db.execute(select(SystemConfig).where(SystemConfig.key == "gemini_api_key"))
            row = result.scalar_one_or_none()
            if row and row.value:
                settings.ai_api_key = decrypt(row.value)
                logger.info("Gemini API Key loaded from system_config")
            # Load AI provider
            result2 = await db.execute(select(SystemConfig).where(SystemConfig.key == "ai_provider"))
            row2 = result2.scalar_one_or_none()
            if row2 and row2.value:
                settings.ai_provider = row2.value
                logger.info(f"AI provider loaded from system_config: {row2.value}")
        except Exception as e:
            logger.warning(f"Could not load config from system_config: {e}")
    setup_scheduler()
    app_scheduler.start()
    logger.info("APScheduler started with 5 jobs")
    yield
    app_scheduler.shutdown(wait=False)
    logger.info("APScheduler shut down")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

# Body size limit — must be added before CORS
app.add_middleware(BodySizeLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

app.include_router(api_router)
app.include_router(health_router)
register_exception_handlers(app)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "data": None,
            "meta": None,
            "error": {"code": "INTERNAL_ERROR", "message": "服务器内部错误，请稍后重试"},
        },
    )

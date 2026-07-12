"""Unified config API — single endpoint for all configuration data.

Replaces: dictionary.py, settings.py config reads, and scattered direct service calls.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import config_service

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/init", response_model=ApiResponse)
async def get_init_config(
    db: AsyncSession = Depends(get_db),
):
    """Initialize config — no auth required for basic dict data."""
    data = await config_service.get_all_config(db)
    return ApiResponse(data=data)


@router.get("/full", response_model=ApiResponse)
async def get_full_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full config with user-scoped permissions, stores, and entitlements."""
    return ApiResponse(data=await config_service.get_user_scoped_config(db, current_user))


@router.get("/quality", response_model=ApiResponse)
async def get_config_quality(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Configuration readiness for business modules."""
    quality = await config_service.get_config_quality(db, current_user)
    return ApiResponse(
        data=quality,
        status=quality.get("status"),
        source_refs=quality.get("source_refs", []),
        evidence_window=quality.get("evidence_window"),
        confidence_reason=quality.get("confidence_reason"),
        data_gaps=quality.get("data_gaps", []),
    )

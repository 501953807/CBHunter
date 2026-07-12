"""API endpoints for product recommendations."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.recommender import RecommenderReadinessResponse, RecommenderResponse
from app.services.recommender_service import build_recommendation_bundle, get_recommender_readiness

router = APIRouter(prefix="/recommender", tags=["recommender"])


@router.get("/readiness", response_model=ApiResponse)
async def get_decision_readiness(
    platform: str = Query(...),
    market: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Report whether real evidence can support rules or model training."""
    readiness = await get_recommender_readiness(db, current_user.id, platform, market)
    return _evidence_response(
        RecommenderReadinessResponse.model_validate(readiness),
        readiness,
        readiness.get("rules_decision_status"),
    )


@router.get("/recommendations", response_model=ApiResponse)
async def get_product_recommendations(
    platform: str = Query(...),
    market: str = Query(...),
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get product recommendations for a specific platform+market+category."""
    bundle = await build_recommendation_bundle(db, current_user.id, platform, market, category)
    return _evidence_response(RecommenderResponse.model_validate(bundle), bundle, bundle.get("status"))


@router.get("/categories", response_model=ApiResponse)
async def list_available_categories(
    platform: str = Query(...),
    market: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List available recommendation categories."""
    bundle = await build_recommendation_bundle(db, current_user.id, platform, market)
    return _evidence_response({
        "platform": platform,
        "market": market,
        "categories": bundle["available_categories"],
    }, bundle, bundle.get("status"))


@router.get("/bundle", response_model=ApiResponse)
async def get_full_recommendation_bundle(
    platform: str = Query(...),
    market: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full recommendation bundle for a store."""
    bundle = await build_recommendation_bundle(db, current_user.id, platform, market)
    return _evidence_response(RecommenderResponse.model_validate(bundle), bundle, bundle.get("status"))


def _evidence_response(data, payload: dict, status: Optional[str]) -> ApiResponse:
    return ApiResponse(
        data=data,
        status=status or ("data_required" if payload.get("data_gaps") else "ready"),
        source_refs=payload.get("source_refs") or [],
        evidence_window=payload.get("evidence_window"),
        confidence_reason=payload.get("confidence_reason"),
        data_gaps=payload.get("data_gaps") or [],
    )

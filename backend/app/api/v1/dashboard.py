"""Dashboard API — consolidated data overview."""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.api.v1.response_helpers import evidence_response
from app.services.dashboard_service import get_dashboard_summary
from app.services.cockpit_service import get_operating_cockpit

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/cockpit", response_model=ApiResponse)
async def operating_cockpit(
    start_date: Optional[date] = Query(None, description="Start date for the cockpit scope"),
    end_date: Optional[date] = Query(None, description="End date for the cockpit scope"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    market: Optional[str] = Query(None, description="Filter by market"),
    platform_account_id: Optional[str] = Query(None, description="Filter by platform account"),
    currency: Optional[str] = Query(None, min_length=3, max_length=10, description="Filter by currency"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Traceable operating cockpit assembled only from persisted business data."""
    return evidence_response(await get_operating_cockpit(
        db,
        current_user.id,
        start_date=start_date,
        end_date=end_date,
        platform=platform,
        market=market,
        platform_account_id=platform_account_id,
        currency=currency,
    ))


@router.get("/summary", response_model=ApiResponse)
async def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate dashboard data: layer counts, pipeline, pending items, recent activity."""
    summary = await get_dashboard_summary(db, current_user.id)
    return ApiResponse(data=summary)


@router.get("/blue-ocean", response_model=ApiResponse)
async def blue_ocean_radar(
    market: Optional[str] = Query(None, description="Filter by market (MY, PH, SG, etc.)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(10, ge=1, le=50, description="Max opportunities to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Blue Ocean Radar: automated product opportunity discovery.

    Scans all active trend keywords and calculates a normalized score from
    available trend, profit, competition, and supply-chain evidence.

    Returns ranked opportunity cards with scores and recommendations.
    """
    from app.services.blue_ocean_radar import scan_blue_ocean
    from app.services.evidence_service import data_required, evidence_payload, unique_refs

    opportunities = await scan_blue_ocean(db, current_user.id, market=market, category=category, limit=limit)
    gaps = [] if opportunities else ["trend_keywords", "sourcing_items", "competitor_or_competition_level"]
    evidence = evidence_payload(
        source_refs=unique_refs([ref for item in opportunities for ref in item.get("source_refs", [])]),
        evidence_window="当前趋势词、选品库成本利润和供应链信号快照",
        confidence_reason="增长机会只基于已有趋势、利润、竞争和供应链信号生成，缺失维度不补默认值。",
        data_gaps=gaps,
    )
    payload = {
        "status": "ready" if opportunities else "data_required",
        "opportunities": opportunities,
        "total": len(opportunities),
        **evidence,
        **({} if opportunities else data_required(
            "暂无可验证增长机会",
            data_gaps=gaps,
            evidence_window="当前趋势词、选品库成本利润和供应链信号快照",
        )),
        "algorithm": {
            "name": "Blue Ocean Score",
            "formula": "可用维度按 Trend×0.30 + Profit×0.25 + Competition×0.25 + Supply×0.20 归一化",
            "calibration_note": "缺失维度不按零分或满分处理，并单独返回资料完整度",
        },
    }
    return evidence_response(payload)

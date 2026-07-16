"""Trend seed API — CRUD + seed discovery endpoints.

Prefix: /api/v1/seeds
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.trend_seed import TrendSeed
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import seed_service
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/seeds", tags=["seeds"])


@router.get("", response_model=ApiResponse)
async def list_seeds(
    category_id: Optional[str] = Query(None),
    market: Optional[str] = Query(None),
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List trend seed keywords (optionally filtered by category / market)."""
    seeds, total = await seed_service.load_seeds_paginated(
        db, category_id=category_id, market=market,
        active_only=active_only, page=page, page_size=page_size,
    )
    return ApiResponse(data={"seeds": seeds, "total": total},
                       meta={"page": page, "page_size": page_size,
                             "total": total, "total_pages": max(1, (total + page_size - 1) // page_size)})


@router.post("", response_model=ApiResponse, status_code=201)
async def create_seed(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new seed keyword."""
    try:
        seed = await seed_service.upsert_seed(db, data)
        await record_audit_event(
            db,
            user=current_user,
            action="create",
            resource_type="trend_seed",
            resource_id=seed["id"],
            new_value=seed,
            detail="创建趋势种子词",
        )
        return ApiResponse(data=seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{seed_id}", response_model=ApiResponse)
async def update_seed(
    seed_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing seed keyword."""
    old_value = await _get_seed_snapshot(db, seed_id)
    if not old_value:
        raise HTTPException(status_code=404, detail="Seed not found")
    data["id"] = seed_id
    try:
        seed = await seed_service.upsert_seed(db, data)
        await record_audit_event(
            db,
            user=current_user,
            action="update",
            resource_type="trend_seed",
            resource_id=seed_id,
            old_value=old_value,
            new_value=seed,
            detail="更新趋势种子词",
        )
        return ApiResponse(data=seed)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{seed_id}", response_model=ApiResponse)
async def delete_seed_endpoint(
    seed_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a seed keyword."""
    old_value = await _get_seed_snapshot(db, seed_id)
    if not old_value:
        raise HTTPException(status_code=404, detail="Seed not found")
    ok = await seed_service.delete_seed(db, seed_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Seed not found")
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="trend_seed",
        resource_id=seed_id,
        old_value=old_value,
        detail="删除趋势种子词",
    )
    return ApiResponse(data={"message": "Deleted"})


@router.post("/reset-defaults", response_model=ApiResponse)
async def reset_defaults(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset seeds to built-in defaults (deletes user-added seeds)."""
    before_total = (await db.execute(select(func.count(TrendSeed.id)))).scalar() or 0
    before_custom = (
        await db.execute(select(func.count(TrendSeed.id)).where(TrendSeed.is_default == False))
    ).scalar() or 0
    count = await seed_service.reset_to_defaults(db)
    await record_audit_event(
        db,
        user=current_user,
        action="reset_defaults",
        resource_type="trend_seed",
        resource_id="defaults",
        old_value={"total": before_total, "custom": before_custom},
        new_value={"default_count": count},
        detail="重置趋势种子词默认值",
    )
    return ApiResponse(data={"message": f"Reset to {count} default seeds"})


@router.post("/discover", response_model=ApiResponse)
async def discover_seeds(
    data: Optional[dict] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run seed discovery — scan Google Trends for fresh seed keywords.

    NEW: Uses Playwright headed browser.  A Chrome window will open on the
    server machine — if Google shows a CAPTCHA, complete it manually in the
    browser window, then the discovery will proceed automatically.

    • Single market: { "market": "MY" }
    • All markets (bulk): { "markets": ["MY","PH","SG",...] }
      Opens browser once, runs all markets sequentially, closes browser.
    """
    payload = data or {}
    if "markets" in payload:
        # Bulk mode — discover for all provided markets
        markets = payload["markets"]
        from app.services.seed_discovery import discover_seeds_all_markets
        result = await discover_seeds_all_markets(db, markets)
        await record_audit_event(
            db,
            user=current_user,
            action="discover",
            resource_type="trend_seed",
            resource_id="bulk",
            new_value={"markets": markets, "result": result},
            detail="批量发现趋势种子词",
        )
        return ApiResponse(data=result)

    market = payload.get("market")
    if not market:
        raise HTTPException(status_code=400, detail="请选择要发现种子的市场")
    from app.services.seed_discovery import discover_seeds_from_google_trends

    result = await discover_seeds_from_google_trends(db, market=market)
    await record_audit_event(
        db,
        user=current_user,
        action="discover",
        resource_type="trend_seed",
        resource_id=market,
        new_value={"market": market, "result": result},
        detail="发现趋势种子词",
    )
    return ApiResponse(data=result)


async def _get_seed_snapshot(db: AsyncSession, seed_id: str) -> Optional[dict]:
    result = await db.execute(select(TrendSeed).where(TrendSeed.id == seed_id))
    seed = result.scalar_one_or_none()
    if not seed:
        return None
    return {
        "id": seed.id,
        "category_id": seed.category_id,
        "keyword": seed.keyword,
        "market": seed.market,
        "language": seed.language,
        "is_default": seed.is_default,
        "is_active": seed.is_active,
        "tags": seed.tags or [],
    }

"""Trend keyword routes for product discovery."""

import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.response_helpers import evidence_response
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.captured_keyword import CapturedKeyword
from app.models.task_run import TaskRun
from app.models.trend_keyword import TrendKeyword
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.discovery import TrendDataUpdate, TrendKeywordCreate
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.captured_keyword_service import (
    delete_captured_keyword as delete_captured_keyword_record,
    get_captured_keywords,
)
from app.services.evidence_service import data_required, source_ref
from app.services.trend_service import (
    add_trend_keyword,
    delete_trend_keyword,
    fetch_all_trends,
    get_last_fetch_time,
    get_trends_by_category,
    update_trend_data,
)

router = APIRouter(prefix="/discovery", tags=["discovery"])


class TrendMatchRequest(BaseModel):
    """Score a product name/description against trend keywords."""
    text: str
    market: Optional[str] = None
    category: Optional[str] = None
    limit: int = 10


@router.get("/trends", response_model=ApiResponse)
async def list_trends(
    category: Optional[str] = Query(None),
    market: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all trend keywords grouped by category and market."""
    data = await get_trends_by_category(db, current_user.id, category, market)
    total = data.get("total_keywords", 0)
    refs = [
        source_ref("trend_keyword", item.get("id"), label=item.get("keyword"), meta={"market": market_id, "category": category_id})
        for category_id, markets in data.get("by_category", {}).items()
        for market_id, keywords in markets.items()
        for item in keywords[:10]
    ]
    return ApiResponse(
        data=data,
        status="ready" if total else "data_required",
        source_refs=refs,
        evidence_window="当前趋势关键词库快照",
        confidence_reason="趋势列表只读取系统同步或用户手工录入的趋势关键词；缺少趋势数据时不使用 mock 关键词填充。",
        data_gaps=[] if total else ["当前筛选下暂无趋势关键词"],
    )


@router.post("/trends", response_model=ApiResponse)
async def add_trend_keyword_endpoint(
    req: TrendKeywordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new keyword to track."""
    kw = await add_trend_keyword(db, current_user.id, req.keyword, req.market, req.category)
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="trend_keyword",
        resource_id=kw.id,
        new_value=_trend_keyword_snapshot(kw),
        detail="新增趋势关键词",
    )
    return ApiResponse(data={"id": kw.id, "keyword": kw.keyword, "market": kw.market, "category": kw.category})


@router.post("/trends/fetch", response_model=ApiResponse)
async def trigger_trend_fetch(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger full trend discovery + sync."""
    started = time.time()
    run = TaskRun(
        task_id="fetch_trends",
        task_name="热门趋势同步",
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()

    try:
        result = await fetch_all_trends(db)
        duration_ms = int((time.time() - started) * 1000)
        run.status = "success"
        run.finished_at = datetime.now(timezone.utc)
        run.duration_ms = duration_ms
        await db.commit()
        await record_audit_event(
            db,
            user=admin,
            action="fetch",
            resource_type="trend_keyword",
            resource_id="fetch_trends",
            new_value={"duration_ms": duration_ms, "result": result},
            detail="手工同步热门趋势",
        )
        return _trend_fetch_response(result)
    except Exception as e:
        duration_ms = int((time.time() - started) * 1000)
        run.status = "failed"
        run.finished_at = datetime.now(timezone.utc)
        run.duration_ms = duration_ms
        run.error_message = str(e)
        await db.commit()
        await record_audit_event(
            db,
            user=admin,
            action="fetch_failed",
            resource_type="trend_keyword",
            resource_id="fetch_trends",
            new_value={"duration_ms": duration_ms, "error": str(e)},
            detail="手工同步热门趋势失败",
        )
        raise HTTPException(status_code=500, detail=f"同步失败: {str(e)}")


@router.get("/trends/status", response_model=ApiResponse)
async def trend_fetch_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get last fetch time and total keyword count."""
    result = await db.execute(
        select(func.count(TrendKeyword.id)).where(
            or_(TrendKeyword.user_id == current_user.id, TrendKeyword.user_id.is_(None))
        )
    )
    total = result.scalar() or 0

    last = await get_last_fetch_time(db)
    categories = await config_service.get_categories(db)
    markets = await config_service.get_markets(db)
    return ApiResponse(data={
        "total_keywords": total,
        "last_fetch_at": last.isoformat() if last else None,
        "categories": [c["id"] for c in categories],
        "markets": [m["id"] for m in markets],
    })


@router.get("/trend-keywords", response_model=ApiResponse)
async def list_trend_keywords_for_matching(
    market: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get flat list of active trend keywords for product matching."""
    from app.services.keyword_bilingual import EN_TO_CN

    query = select(TrendKeyword).where(
        or_(TrendKeyword.user_id == current_user.id, TrendKeyword.user_id.is_(None))
    )
    if market:
        query = query.where(TrendKeyword.market == market)
    if category:
        query = query.where(TrendKeyword.category == category)
    query = query.order_by(TrendKeyword.growth_pct.desc().nullslast())

    result = await db.execute(query)
    keywords = result.scalars().all()

    items = []
    for kw in keywords:
        cn_terms = EN_TO_CN.get(kw.keyword.lower(), [kw.keyword])
        items.append({
            "id": kw.id,
            "keyword": kw.keyword,
            "cn_terms": cn_terms,
            "market": kw.market,
            "category": kw.category,
            "trend_direction": kw.trend_direction,
            "growth_pct": kw.growth_pct,
            "search_volume": kw.search_volume,
        })

    return ApiResponse(data={"items": items, "total": len(items)})


@router.post("/trends/match", response_model=ApiResponse)
async def match_trend_keywords(
    req: TrendMatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Score product text against known trend keywords for relevance matching."""
    if not req.text.strip():
        return ApiResponse(data={"matches": [], "total": 0})

    text_lower = req.text.lower()
    words = set(text_lower.split())

    query = select(TrendKeyword).where(
        or_(TrendKeyword.user_id == current_user.id, TrendKeyword.user_id.is_(None))
    )
    if req.market:
        query = query.where(TrendKeyword.market == req.market)
    if req.category:
        query = query.where(TrendKeyword.category == req.category)

    result = await db.execute(query)
    keywords = list(result.scalars().all())

    matches = []
    for kw in keywords:
        kw_lower = kw.keyword.lower()
        if kw_lower in text_lower:
            score = 80
            ratio = len(kw_lower) / max(len(text_lower), 1)
            if ratio > 0.5:
                score = 95
            elif ratio > 0.3:
                score = 85
        else:
            kw_words = set(kw_lower.split())
            common = words & kw_words
            if common:
                score = 40 + len(common) * 15
            else:
                continue

        matches.append({
            "id": kw.id,
            "keyword": kw.keyword,
            "market": kw.market,
            "relevance_score": min(score, 100),
            "growth_pct": kw.growth_pct,
            "trend_direction": kw.trend_direction,
        })

    matches.sort(key=lambda x: x["relevance_score"], reverse=True)
    matches = matches[:req.limit]

    return ApiResponse(data={
        "matches": matches,
        "total": len(matches),
        "analyzed_text": req.text[:100],
    })


@router.put("/trends/{keyword_id}", response_model=ApiResponse)
async def update_trend(
    keyword_id: str,
    req: TrendDataUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually update trend data for a keyword (user-recorded)."""
    old_keyword = await _get_user_trend_keyword(db, keyword_id, current_user.id)
    if not old_keyword:
        raise HTTPException(status_code=404, detail="Trend keyword not found")
    old_value = _trend_keyword_snapshot(old_keyword)
    kw = await update_trend_data(db, current_user.id, keyword_id, req.model_dump(exclude_unset=True))
    if not kw:
        raise HTTPException(status_code=404, detail="Trend keyword not found")
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="trend_keyword",
        resource_id=kw.id,
        old_value=old_value,
        new_value=_trend_keyword_snapshot(kw),
        detail="更新趋势关键词数据",
    )
    return ApiResponse(data={"id": kw.id, "trend_direction": kw.trend_direction, "growth_pct": kw.growth_pct})


@router.delete("/trends/{keyword_id}", response_model=ApiResponse)
async def delete_trend(
    keyword_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a trend keyword."""
    old_keyword = await _get_user_trend_keyword(db, keyword_id, current_user.id)
    if not old_keyword:
        raise HTTPException(status_code=404, detail="Trend keyword not found")
    old_value = _trend_keyword_snapshot(old_keyword)
    deleted = await delete_trend_keyword(db, current_user.id, keyword_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Trend keyword not found")
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="trend_keyword",
        resource_id=keyword_id,
        old_value=old_value,
        detail="删除趋势关键词",
    )
    return ApiResponse(data={"message": "Keyword deleted"})


@router.post("/trends/{keyword_id}/return", response_model=ApiResponse)
async def return_trend_to_active(
    keyword_id: str,
    current_user: User = Depends(get_current_user),
):
    """The current trend feed no longer consumes rows."""
    raise HTTPException(status_code=410, detail="趋势词不再从热门趋势中移除，无需退回")


@router.get("/captured-keywords", response_model=ApiResponse)
async def list_captured_keywords(
    category: Optional[str] = Query(None),
    market: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user-captured keywords grouped by category and market."""
    data = await get_captured_keywords(db, current_user.id, category, market)
    records = [
        item
        for markets in data["by_category"].values()
        for items in markets.values()
        for item in items
    ]
    gaps = []
    if not records:
        gaps.append("当前筛选范围没有已捕获趋势关键词")
    if any(item.get("search_volume") is None for item in records):
        gaps.append("部分关键词缺少真实搜索量")
    if any(item.get("trend_direction") is None for item in records):
        gaps.append("部分关键词缺少趋势方向")
    return ApiResponse(
        data=data,
        status="ready" if records else "data_required",
        source_refs=[source_ref("captured_keyword", item["id"], label=item["keyword"]) for item in records],
        evidence_window="已捕获关键词的最新保存快照",
        confidence_reason="选品信号仅展示用户捕获并持久化的趋势关键词；搜索量或趋势缺失时保持未知。",
        data_gaps=gaps,
    )


@router.delete("/captured-keywords/{keyword_id}", response_model=ApiResponse)
async def delete_captured_keyword(
    keyword_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a captured keyword from history."""
    captured = await _get_captured_keyword(db, keyword_id, current_user.id)
    if not captured:
        raise HTTPException(status_code=404, detail="Captured keyword not found")
    old_value = _captured_keyword_snapshot(captured)
    ok = await delete_captured_keyword_record(db, keyword_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Captured keyword not found")
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="captured_keyword",
        resource_id=keyword_id,
        old_value=old_value,
        detail="删除已捕获趋势关键词",
    )
    return ApiResponse(data={"deleted": keyword_id})


@router.get("/categories", response_model=ApiResponse)
async def list_trend_categories(
    db: AsyncSession = Depends(get_db),
):
    """Return standardized e-commerce categories."""
    categories = await config_service.get_categories(db)
    markets = await config_service.get_markets(db)
    return ApiResponse(data={
        "categories": categories,
        "markets": markets,
    })


def _trend_fetch_response(result: dict) -> ApiResponse:
    total = int(result.get("total") or 0)
    errors = result.get("errors") or []
    if total > 0 and not errors:
        return ApiResponse(
            data=result,
            status="ready",
            source_refs=[source_ref("trend_sync", "fetch_trends", meta={"records_synced": total})],
            evidence_window="本次趋势同步执行窗口",
            confidence_reason="趋势关键词来自本次 Google Trends/Pinterest 实际采集与交叉验证结果。",
            data_gaps=[],
        )

    enriched = {
        **result,
        "next_actions": [
            "确认 Google Trends 可访问或已配置可用网络环境",
            "如需 Pinterest 自动同步，先在设置中心配置 Pinterest 凭证",
            "无法自动采集时，可在流行趋势页手工录入公开链接、截图或趋势摘要作为资料",
        ],
    }
    payload = data_required(
        result.get("message") or "本次未同步到趋势关键词",
        data_gaps=["trend_sync.external_sources", *errors],
        source_refs=[source_ref("trend_sync", "fetch_trends", meta={"records_synced": total})],
        evidence_window="本次趋势同步执行窗口",
        confidence_reason="外部趋势来源未返回可入库关键词，系统保留现有数据且不生成模拟趋势。",
    )
    return evidence_response({**enriched, **payload})


async def _get_user_trend_keyword(db: AsyncSession, keyword_id: str, user_id: str) -> Optional[TrendKeyword]:
    result = await db.execute(
        select(TrendKeyword).where(
            TrendKeyword.id == keyword_id,
            TrendKeyword.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _get_captured_keyword(db: AsyncSession, keyword_id: str, user_id: str) -> Optional[CapturedKeyword]:
    result = await db.execute(
        select(CapturedKeyword).where(
            CapturedKeyword.id == keyword_id,
            CapturedKeyword.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def _trend_keyword_snapshot(keyword: TrendKeyword) -> dict:
    return {
        "id": keyword.id,
        "keyword": keyword.keyword,
        "market": keyword.market,
        "category": keyword.category,
        "search_volume": keyword.search_volume,
        "trend_direction": keyword.trend_direction,
        "growth_pct": keyword.growth_pct,
        "competition_level": keyword.competition_level,
        "source": keyword.source,
        "pinterest_volume": keyword.pinterest_volume,
        "pinterest_direction": keyword.pinterest_direction,
        "pinterest_growth": keyword.pinterest_growth,
        "has_pinterest_data": keyword.has_pinterest_data,
        "cross_validation_score": keyword.cross_validation_score,
        "cross_validation_detail": keyword.cross_validation_detail,
    }


def _captured_keyword_snapshot(keyword: CapturedKeyword) -> dict:
    return {
        "id": keyword.id,
        "keyword": keyword.keyword,
        "market": keyword.market,
        "category": keyword.category,
        "search_volume": keyword.search_volume,
        "trend_direction": keyword.trend_direction,
        "growth_pct": keyword.growth_pct,
        "competition_level": keyword.competition_level,
        "source": keyword.source,
        "has_pinterest_data": keyword.has_pinterest_data,
        "cross_validation_score": keyword.cross_validation_score,
        "cross_validation_detail": keyword.cross_validation_detail,
    }

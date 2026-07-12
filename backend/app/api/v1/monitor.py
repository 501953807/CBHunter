"""Competitor monitoring API — real DB-backed using competitor_product data."""

import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.competitor_product import CompetitorProduct
from app.schemas.common import ApiResponse
from app.api.v1.response_helpers import evidence_response
from app.services import research_service
from app.services.audit_service import record_audit_event
from app.services.entitlement_service import require_entitlement
from app.services.evidence_service import evidence_payload, source_ref

router = APIRouter(prefix="/monitor", tags=["monitor"])


@router.post("/competitor", response_model=ApiResponse)
async def add_competitor(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Track a competitor product by URL. Creates a real CompetitorProduct row."""
    url = data.get("url", "")
    platform = data.get("platform", "")
    name = data.get("name", "") or url
    seller_name = data.get("seller_name", "")
    price = data.get("price")
    market = data.get("market", "")
    currency = data.get("currency", "")

    if not url:
        raise HTTPException(400, "URL is required")
    if not platform:
        raise HTTPException(400, "Platform is required")
    from app.services.config_service import get_markets, get_platforms
    approved_platforms = {item["id"] for item in await get_platforms(db)}
    approved_markets = {item["id"]: item for item in await get_markets(db)}
    if platform not in approved_platforms:
        raise HTTPException(400, "平台不在当前审批范围")
    if market not in approved_markets:
        raise HTTPException(400, "请选择已配置的东南亚市场")
    expected_currency = approved_markets[market].get("currency")
    if not currency or currency != expected_currency:
        raise HTTPException(400, "币种必须与目标市场配置一致")

    existing_count = await db.scalar(
        select(func.count(CompetitorProduct.id)).where(
            CompetitorProduct.user_id == current_user.id,
            CompetitorProduct.is_tracked == True,
        )
    ) or 0
    await require_entitlement(db, current_user, "competitor.monitors.max", existing_count + 1)

    competitor = await research_service.create_competitor(
        db,
        user_id=current_user.id,
        data={
            "platform": platform,
            "name": name,
            "seller_name": seller_name,
            "price": price,
            "url": url,
            "market": market,
            "currency": currency,
            "collection_method": "manual_url",
            "confidence_level": "merchant_input",
        },
    )
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="competitor_product",
        resource_id=competitor.id,
        new_value=_competitor_snapshot(competitor),
        detail="添加竞品追踪",
    )

    return ApiResponse(data={
        "id": competitor.id,
        "url": url,
        "platform": platform,
        "name": name,
        "status": "tracking",
        "tracked_at": datetime.now(timezone.utc).isoformat(),
    })


@router.get("/dashboard", response_model=ApiResponse)
async def competitor_dashboard(
    platform: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get competitor monitoring dashboard data."""
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)

    filters = [CompetitorProduct.user_id == current_user.id, CompetitorProduct.is_tracked == True]
    if platform:
        filters.append(CompetitorProduct.platform == platform)

    result = await db.execute(select(func.count(CompetitorProduct.id)).where(
        and_(*filters)
    ))
    total_tracked = result.scalar() or 0

    # Competitors added in last 24h
    result = await db.execute(select(func.count(CompetitorProduct.id)).where(
        and_(*filters, CompetitorProduct.last_updated >= last_24h)
    ))
    new_listings_24h = result.scalar() or 0

    # List all tracked competitors
    result = await db.execute(
        select(CompetitorProduct)
        .where(and_(*filters))
        .order_by(CompetitorProduct.last_updated.desc())
        .limit(50)
    )
    competitors = result.scalars().all()

    competitor_list = []
    price_changes_24h = 0

    for c in competitors:
        last_updated = _as_utc(c.last_updated)
        price_history = c.price_history or []
        prev_price = None
        current_price = c.price

        if isinstance(price_history, list) and len(price_history) > 0:
            recent = [p for p in price_history if isinstance(p, dict) and p.get("recorded_at")]
            if recent:
                recent.sort(key=lambda p: p["recorded_at"], reverse=True)
                prev_price = recent[0].get("price")

        if prev_price is not None and current_price is not None and prev_price != current_price:
            price_changes_24h += 1

        competitor_list.append({
            "id": c.id,
            "platform": c.platform,
            "name": c.name,
            "seller_name": c.seller_name,
            "price": current_price,
            "currency": c.currency,
            "market": c.market,
            "collection_method": c.collection_method,
            "confidence_level": c.confidence_level,
            "is_new_24h": bool(last_updated and last_updated >= last_24h),
            "prev_price": prev_price,
            "sales_estimate": c.sales_estimate,
            "rating": c.rating,
            "review_count": c.review_count,
            "is_tracked": c.is_tracked,
            "last_updated": last_updated.isoformat() if last_updated else None,
        })

    data_gaps = []
    if not competitor_list:
        data_gaps.append("competitor_products")
    data_gaps.append("competitor_products.delisted_status")
    return evidence_response({
        "status": "ready" if competitor_list else "data_required",
        "total_tracked": total_tracked,
        "price_changes_24h": price_changes_24h,
        "new_listings_24h": new_listings_24h,
        "delisted_24h": None,
        "competitors": competitor_list,
        **evidence_payload(
            source_refs=[
                source_ref(
                    "competitor_product",
                    item["id"],
                    label=item["name"],
                    fields=["price", "currency", "market", "collection_method", "confidence_level", "sales_estimate", "rating", "review_count"],
                    meta={"source_label": "竞品快照", "route": "/monitor"},
                )
                for item in competitor_list[:20]
            ],
            evidence_window="当前竞品表快照与最近价格历史",
            confidence_reason="竞品监控只展示已跟踪竞品记录和价格历史；未接入平台页面状态采集前不输出下架数量。",
            data_gaps=data_gaps,
        ),
    })


@router.post("/alert-rules", response_model=ApiResponse)
async def set_alert_rule(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set alert rules for a tracked competitor. Stored as JSON on the competitor record."""
    competitor_id = data.get("competitor_id")
    condition = data.get("condition", "")
    threshold = data.get("threshold", 0)

    if not competitor_id:
        raise HTTPException(400, "competitor_id is required")

    stmt = select(CompetitorProduct).where(
        and_(CompetitorProduct.id == competitor_id, CompetitorProduct.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(404, "竞品不存在")

    alert_rules = {
        "condition": condition,
        "threshold": threshold,
        "enabled": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    old_notes = comp.notes
    comp.notes = json.dumps({"alert_rules": alert_rules}, ensure_ascii=False)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="competitor_alert_rule",
        resource_id=competitor_id,
        old_value={"notes": old_notes},
        new_value={"alert_rules": alert_rules},
        detail="设置竞品预警规则",
    )

    return ApiResponse(data={
        "competitor_id": competitor_id,
        "condition": condition,
        "threshold": threshold,
        "enabled": True,
    })


def _competitor_snapshot(comp: CompetitorProduct) -> dict:
    return {
        "id": comp.id,
        "platform": comp.platform,
        "platform_product_id": comp.platform_product_id,
        "name": comp.name,
        "seller_name": comp.seller_name,
        "price": comp.price,
        "currency": comp.currency,
        "market": comp.market,
        "collection_method": comp.collection_method,
        "confidence_level": comp.confidence_level,
        "url": comp.url,
        "is_tracked": comp.is_tracked,
    }


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

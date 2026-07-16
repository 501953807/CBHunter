"""选品信号捕获 API — 将品源操作的灵感快速录入为信号."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.database import get_db
from app.dependencies import get_current_user
from app.models.sourcing_item import SourcingItem
from app.models.supply_product import SupplyProduct
from app.models.user import User
from app.api.v1.response_helpers import evidence_response
from app.schemas.common import ApiResponse
from app.services.audit_service import record_audit_event
from app.services.signal_service import (
    list_signals as db_list_signals,
    create_signal as db_create_signal,
    get_signal as db_get_signal,
    mark_converted as db_mark_converted,
    get_signal_stats as db_signal_stats,
)
from app.services.scout_funnel_service import get_signal_funnel
from app.services.scout_source_config import get_scout_source, get_scout_sources
from app.services import config_service
from app.services.evidence_service import configuration_required, source_ref
from sqlalchemy import or_, select

router = APIRouter(prefix="/scout", tags=["scout"])


class CaptureSignalRequest(BaseModel):
    source_id: str
    keyword: str
    product_idea: str
    source_url: Optional[str] = None
    heat_level: Optional[int] = None
    competition_estimate: Optional[str] = None
    profit_potential: Optional[str] = None
    platform: Optional[str] = None
    market: Optional[str] = None
    category: Optional[str] = None
    search_volume: Optional[int] = None
    trend_direction: Optional[str] = None
    growth_pct: Optional[float] = None
    competition_level: Optional[str] = None
    # Trending product fields (platform layer)
    product_name: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    sales_volume: Optional[int] = None
    sales_growth_rate: Optional[float] = None
    category_path: Optional[str] = None

class DecisionRequest(BaseModel):
    weight: int = Field(gt=0, le=10)
    competition: int = Field(gt=0, le=10)
    margin: int = Field(gt=0, le=10)
    video_show: int = Field(gt=0, le=10)
    seasonality: int = Field(gt=0, le=10)
    supplier_count: int = Field(gt=0, le=10)
    repurchase: int = Field(gt=0, le=10)
    pain_point: int = Field(gt=0, le=10)
    price: int = Field(gt=0, le=10)
    work_item_id: Optional[str] = None
    object_refs: list[dict] = Field(default_factory=list)
    product_name: Optional[str] = None
    target_platform: Optional[str] = None
    target_market: Optional[str] = None


DECISION_SCORE_FIELDS = {
    "weight",
    "competition",
    "margin",
    "video_show",
    "seasonality",
    "supplier_count",
    "repurchase",
    "pain_point",
    "price",
}


async def _get_decision_policy(db: AsyncSession) -> Optional[dict]:
    policy = await config_service.get_config_json(db, "selection.decision_policy")
    if not policy:
        return None
    dimensions = policy.get("dimensions")
    decisions = policy.get("decisions")
    required_numbers = ("green_threshold", "yellow_threshold", "green_required", "yellow_required")
    if not isinstance(dimensions, list) or {item.get("key") for item in dimensions if isinstance(item, dict)} != DECISION_SCORE_FIELDS:
        return None
    if not isinstance(decisions, dict) or not all(isinstance(decisions.get(level), dict) for level in ("green", "yellow", "red")):
        return None
    if not all(isinstance(policy.get(key), int) for key in required_numbers):
        return None
    return _normalize_decision_policy(policy)


def _normalize_decision_policy(policy: dict) -> dict:
    normalized = {**policy}
    green_threshold = int(normalized["green_threshold"])
    yellow_threshold = int(normalized["yellow_threshold"])
    if green_threshold > 10 or yellow_threshold > 10:
        normalized["green_threshold"] = 7
        normalized["yellow_threshold"] = 4
    return normalized


@router.get("/sources", response_model=ApiResponse)
async def list_signal_sources():
    """获取10大品源列表及操作指引."""
    return ApiResponse(data=get_scout_sources())


@router.get("/sources/{source_id}", response_model=ApiResponse)
async def get_source_detail(source_id: str):
    """获取单个品源详情及操作指引."""
    src = get_scout_source(source_id)
    if not src:
        raise HTTPException(status_code=404, detail="品源不存在")
    return ApiResponse(data=src)


@router.get("/funnel", response_model=ApiResponse)
async def get_four_layer_funnel(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取四层信号漏斗、信号流和归并候选商品卡."""
    data = await get_signal_funnel(db, current_user.id)
    return ApiResponse(
        data=data,
        status="ready" if data["metrics"]["signal_count"] else "data_required",
        source_refs=[
            source_ref("signal", field="signals"),
            source_ref("trend_keyword", field="trend_keywords"),
            source_ref("trending_product", field="trending_products"),
            source_ref("supply_product", field="supply_products"),
        ],
        evidence_window="当前用户四层品源信号、趋势关键词、平台热卖与供应商品记录",
        confidence_reason="候选商品只由已持久化的真实记录按标题归并，不使用 mock 热度、销量或利润。",
        data_gaps=[] if data["metrics"]["signal_count"] else ["scout.signals"],
    )


@router.post("/signals", response_model=ApiResponse, status_code=201)
async def capture_signal(
    req: CaptureSignalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """快速录入一条选品信号。趋势层的信号同步写入趋势热点关键词."""
    source = get_scout_source(req.source_id)
    if not source:
        raise HTTPException(status_code=400, detail="无效的品源ID")

    source_name = source["name"]
    layer = source["layer"]

    # Save to database
    db_signal = await db_create_signal(db, current_user.id, {
        "layer": layer,
        "source": req.source_id,
        "title": req.keyword,
        "content": req.product_idea,
        "source_url": req.source_url,
    })

    signal = {
        "id": db_signal.id,
        "source_id": req.source_id,
        "source_name": source_name,
        "keyword": req.keyword,
        "product_idea": req.product_idea,
        "source_url": req.source_url,
        "heat_level": min(max(req.heat_level, 0), 100) if req.heat_level is not None else None,
        "competition_estimate": req.competition_estimate,
        "profit_potential": req.profit_potential,
        "platform": req.platform,
        "market": req.market,
        "status": "captured",
        "captured_at": db_signal.created_at.isoformat() if db_signal.created_at else datetime.now(timezone.utc).isoformat(),
    }

    # 趋势层信号 → 插入到 captured_keywords 历史表
    if source.get("signal_kind") == "trend_keyword":
        from app.models.trend_keyword import TrendKeyword
        from app.models.captured_keyword import CapturedKeyword
        from sqlalchemy import select

        market = req.market
        now = datetime.now(timezone.utc)

        # Try to find existing trend_keyword data for a richer snapshot
        result = await db.execute(
            select(TrendKeyword).where(
                or_(TrendKeyword.user_id == current_user.id, TrendKeyword.user_id.is_(None)),
                TrendKeyword.keyword == req.keyword,
                TrendKeyword.market == market,
            ).limit(1)
        )
        existing_tk = result.scalars().first()

        # Preserve real trend snapshots only. If none exists, keep an empty list.
        td = existing_tk.trend_data if (existing_tk and existing_tk.trend_data) else []

        # Snapshot Pinterest data if available from existing trend keyword
        pv = existing_tk.pinterest_volume if existing_tk else None
        pd = existing_tk.pinterest_direction if existing_tk else None
        pg = existing_tk.pinterest_growth if existing_tk else None
        ptd = existing_tk.pinterest_trend_data if existing_tk else []
        hpd = existing_tk.has_pinterest_data if existing_tk else False
        cvs = existing_tk.cross_validation_score if existing_tk else None
        cvd = existing_tk.cross_validation_detail if existing_tk else None
        cva = existing_tk.cross_validated_at if existing_tk else None

        # Create captured keyword record (always new insert into history)
        ck = CapturedKeyword(
            keyword=req.keyword,
            market=market,
            category=req.category,
            search_volume=req.search_volume,
            trend_direction=req.trend_direction,
            growth_pct=req.growth_pct,
            competition_level=req.competition_level or req.competition_estimate,
            source=source.get("trend_source", "manual"),
            trend_data=td,
            # Snapshot Pinterest data if available from existing trend keyword
            pinterest_volume=pv,
            pinterest_direction=pd,
            pinterest_growth=pg,
            pinterest_trend_data=ptd,
            has_pinterest_data=hpd,
            cross_validation_score=cvs,
            cross_validation_detail=cvd,
            cross_validated_at=cva,
            user_id=current_user.id,
        )
        db.add(ck)
        await db.commit()
        await record_audit_event(
            db,
            user=current_user,
            action="capture",
            resource_type="captured_keyword",
            resource_id=ck.id,
            new_value={
                "id": ck.id,
                "keyword": ck.keyword,
                "market": ck.market,
                "category": ck.category,
                "source": ck.source,
                "search_volume": ck.search_volume,
                "trend_direction": ck.trend_direction,
                "growth_pct": ck.growth_pct,
                "competition_level": ck.competition_level,
            },
            detail="Scout 信号捕获为趋势关键词",
        )

    # 平台层信号 → 同步写入热卖商品
    if source.get("signal_kind") == "trending_product":
        from app.models.trending_product import TrendingProduct

        platform = req.platform or source.get("platform")
        if not platform:
            raise HTTPException(status_code=400, detail="平台层信号缺少平台")
        now = datetime.now(timezone.utc)

        product = TrendingProduct(
            user_id=current_user.id,
            platform=platform,
            platform_product_id=f"sig_{now.timestamp()}",
            name=req.product_name or req.keyword,
            price_min=req.price_min,
            price_max=req.price_max,
            sales_volume=req.sales_volume,
            sales_growth_rate=req.sales_growth_rate,
            category_path=req.category_path,
            tags=[req.market] if req.market else [],
            discovered_at=now,
            last_updated=now,
        )
        db.add(product)
        await db.commit()
        await record_audit_event(
            db,
            user=current_user,
            action="capture",
            resource_type="trending_product",
            resource_id=product.id,
            new_value=_trending_product_snapshot(product),
            detail="Scout 平台层信号捕获为热卖商品",
        )

    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="signal",
        resource_id=db_signal.id,
        new_value=_signal_snapshot(db_signal),
        detail="捕获 Scout 选品信号",
    )

    return ApiResponse(data=signal)


@router.get("/prompts", response_model=ApiResponse)
async def list_prompts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回潮流推荐提示词列表."""
    items, _ = await db_list_signals(
        db,
        current_user.id,
        layer="culture",
        page=1,
        page_size=50,
    )
    return ApiResponse(data=[
        {
            "id": item.id,
            "source_id": item.source,
            "source_name": (get_scout_source(item.source) or {}).get("name", item.source),
            "keyword": item.title,
            "product_idea": item.content or "",
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ])


@router.post("/prompts", response_model=ApiResponse, status_code=201)
async def add_prompt(
    req: CaptureSignalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """添加入一条潮流推荐提示词（支持富文本内容）."""
    # Strip HTML for keyword if it has HTML tags
    import re
    keyword = req.keyword
    if keyword and '<' in keyword:
        keyword = re.sub(r'<[^>]+>', '', keyword).strip()[:100]
    prompt = await db_create_signal(db, current_user.id, {
        "layer": "culture",
        "source": req.source_id,
        "title": keyword or "潮流推荐",
        "content": req.product_idea,
        "source_url": req.source_url,
    })
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="signal",
        resource_id=prompt.id,
        new_value=_signal_snapshot(prompt),
        detail="新增潮流推荐提示词",
    )
    return ApiResponse(data={
        "id": prompt.id,
        "source_id": prompt.source,
        "source_name": (get_scout_source(prompt.source) or {}).get("name", prompt.source),
        "keyword": prompt.title,
        "product_idea": prompt.content or "",
        "created_at": prompt.created_at.isoformat() if prompt.created_at else None,
    })


@router.get("/signals", response_model=ApiResponse)
async def list_signals(
    source_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """信号列表 (persisted in DB)."""
    items, total = await db_list_signals(
        db, current_user.id,
        source=source_id,
        page=page, page_size=page_size,
    )
    result = []
    for s in items:
        result.append({
            "id": s.id,
            "source_id": s.source,
            "source_name": (get_scout_source(s.source) or {}).get("name", s.source),
            "keyword": s.title,
            "product_idea": s.content or "",
            "layer": s.layer,
            "status": "converted" if s.converted else "captured",
            "captured_at": s.created_at.isoformat() if s.created_at else "",
        })
    return ApiResponse(
        data=result,
        meta={"page": page, "page_size": page_size, "total": total, "total_pages": max(1, (total + page_size - 1) // page_size)},
    )


@router.post("/signals/{signal_id}/convert", response_model=ApiResponse)
async def convert_signal_to_sourcing(
    signal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """将信号转为选品库中的产品."""
    signal = await db_get_signal(db, signal_id, current_user.id)
    if not signal:
        raise HTTPException(status_code=404, detail="信号不存在")
    old_value = _signal_snapshot(signal)

    from app.services.sourcing_service import create_item
    item = await create_item(db, current_user.id, {
        "source_name": signal.source,
        "product_name": (signal.content or signal.title)[:200],
        "product_name_cn": signal.title,
        "category": None,
        "pipeline_stage": "discovery",
        "notes": f"品源: {signal.source} | 关键词: {signal.title}",
    })

    await db_mark_converted(db, signal_id, current_user.id, item.id)
    converted = await db_get_signal(db, signal_id, current_user.id)
    await record_audit_event(
        db,
        user=current_user,
        action="convert",
        resource_type="signal",
        resource_id=signal_id,
        old_value=old_value,
        new_value=_signal_snapshot(converted) if converted else {"sourcing_item_id": item.id},
        detail="Scout 信号转入选品库",
    )
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="sourcing_item",
        resource_id=item.id,
        new_value={
            "id": item.id,
            "source_name": item.source_name,
            "product_name": item.product_name,
            "product_name_cn": item.product_name_cn,
            "category": item.category,
            "pipeline_stage": item.pipeline_stage,
            "notes": item.notes,
        },
        detail="由 Scout 信号生成选品记录",
    )

    return ApiResponse(data={"sourcing_item": {"id": item.id, "product_name": item.product_name}})


@router.post("/decide", response_model=ApiResponse)
async def execute_decision(
    req: DecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """执行9维度选品决策矩阵 → 绿灯计数 → 决策输出."""
    policy = await _get_decision_policy(db)
    if not policy:
        return _decision_policy_required_response()
    policy = _normalize_decision_policy(policy)
    green_threshold = int(policy["green_threshold"])
    yellow_threshold = int(policy["yellow_threshold"])
    scores = {
        "weight": req.weight,
        "competition": req.competition,
        "margin": req.margin,
        "video_show": req.video_show,
        "seasonality": req.seasonality,
        "supplier_count": req.supplier_count,
        "repurchase": req.repurchase,
        "pain_point": req.pain_point,
        "price": req.price,
    }
    green_count = sum(1 for v in scores.values() if v >= green_threshold)
    yellow_count = sum(1 for v in scores.values() if green_threshold > v >= yellow_threshold)
    red_count = len(scores) - green_count - yellow_count
    average_score = round(sum(scores.values()) / len(scores), 1)
    decisions = policy["decisions"]

    if green_count >= int(policy["green_required"]):
        decision = "green_light"
        decision_config = decisions["green"]
    elif green_count >= int(policy["yellow_required"]):
        decision = "yellow_light"
        decision_config = decisions["yellow"]
    else:
        decision = "red_light"
        decision_config = decisions["red"]

    score_breakdown = [
        {"dimension": d, "score": s, "level": "green" if s >= green_threshold else "yellow" if s >= yellow_threshold else "red"}
        for d, s in scores.items()
    ]

    result = {
        "green_count": green_count,
        "yellow_count": yellow_count,
        "red_count": red_count,
        "average_score": average_score,
        "decision": decision,
        "decision_label": decision_config["label"],
        "action": decision_config["action"],
        "policy": {"green_threshold": green_threshold, "yellow_threshold": yellow_threshold},
        "score_breakdown": score_breakdown,
    }
    product_context = _decision_product_context(req)
    if product_context:
        result["product_context"] = product_context
    content_queue_item = await _promote_green_decision_to_content_queue(db, current_user.id, product_context, decision)
    if content_queue_item:
        result["content_queue_item"] = content_queue_item
    await record_audit_event(
        db,
        user=current_user,
        action="decide",
        resource_type="scout_decision",
        resource_id=req.work_item_id or "matrix",
        new_value={"scores": scores, **result},
        detail="执行 Scout 九维选品决策矩阵" if not product_context else f"执行 Scout 九维选品决策矩阵：{product_context['product_name']}",
    )
    refs = [source_ref("system_config", "selection.decision_policy")]
    refs.extend(_decision_product_refs(product_context))
    return ApiResponse(
        data=result,
        status="ready",
        source_refs=refs,
        evidence_window="当前九维选品决策策略与本次人工评分",
        confidence_reason="决策只汇总用户显式评分，并按统一配置阈值分级。",
        data_gaps=[],
    )


@router.get("/decision-config", response_model=ApiResponse)
async def get_decision_config(db: AsyncSession = Depends(get_db)):
    policy = await _get_decision_policy(db)
    if not policy:
        return _decision_policy_required_response()
    return ApiResponse(
        data=policy, status="ready",
        source_refs=[source_ref("system_config", "selection.decision_policy")],
        evidence_window="当前生效的九维选品决策策略",
        confidence_reason="维度、阈值和行动建议由统一配置目录提供。",
        data_gaps=[],
    )


def _decision_policy_required_response() -> ApiResponse:
    return evidence_response(configuration_required(
        "九维选品决策必须读取统一策略配置。",
        data_gaps=["selection.decision_policy"],
        source_refs=[source_ref("system_config", "selection.decision_policy")],
        evidence_window="当前九维选品决策策略配置",
        confidence_reason="九维选品决策必须读取统一策略配置。",
    ))


def _signal_snapshot(signal) -> dict:
    return {
        "id": signal.id,
        "layer": signal.layer,
        "source": signal.source,
        "title": signal.title,
        "content": signal.content,
        "source_url": signal.source_url,
        "source_image": signal.source_image,
        "analysis_status": signal.analysis_status,
        "converted": signal.converted,
        "sourcing_item_id": signal.sourcing_item_id,
        "is_active": signal.is_active,
    }


def _decision_product_context(req: DecisionRequest) -> Optional[dict]:
    if not req.work_item_id and not req.product_name and not req.object_refs:
        return None
    return {
        "work_item_id": req.work_item_id,
        "object_refs": req.object_refs,
        "product_name": req.product_name or _object_ref_label(req.object_refs) or "未命名候选商品",
        "target_platform": req.target_platform,
        "target_market": req.target_market,
    }


def _decision_product_refs(product_context: Optional[dict]) -> list[dict]:
    if not product_context:
        return []
    refs = []
    for item in product_context.get("object_refs") or []:
        if not item.get("type"):
            continue
        refs.append(source_ref(
            str(item.get("type")),
            item.get("id"),
            label=item.get("label") or product_context.get("product_name"),
        ))
    if refs:
        return refs
    work_item_id = product_context.get("work_item_id")
    if not work_item_id or ":" not in work_item_id:
        return []
    ref_type, ref_id = work_item_id.split(":", 1)
    return [source_ref(ref_type, ref_id, label=product_context.get("product_name"))]


async def _promote_green_decision_to_content_queue(
    db: AsyncSession | None,
    user_id: str,
    product_context: Optional[dict],
    decision: str,
) -> Optional[dict]:
    if db is None or decision != "green_light" or not product_context:
        return None
    supply_ref = next(
        (
            item for item in product_context.get("object_refs") or []
            if item.get("type") == "supply_product" and item.get("id")
        ),
        None,
    )
    if not supply_ref:
        return None
    supply = await db.get(SupplyProduct, supply_ref["id"])
    if not supply or supply.user_id != user_id or not supply.is_active:
        return None
    marker = {"type": "supply_product", "id": supply.id}
    existing = await db.execute(select(SourcingItem).where(SourcingItem.user_id == user_id))
    item = next(
        (
            row for row in existing.scalars().all()
            if (row.extra_data or {}).get("selection_source_ref") == f"supply_product:{supply.id}"
        ),
        None,
    )
    if not item:
        item = SourcingItem(
            user_id=user_id,
            product_name=product_context.get("product_name") or supply.name,
            source_name=supply.platform or "1688",
            source_url=supply.product_url,
            source_price_rmb=_avg_price(supply.price_min, supply.price_max),
            category=supply.category_path,
            platform=product_context.get("target_platform"),
            market=product_context.get("target_market"),
            source_image=(supply.images or [None])[0],
            pipeline_stage="content_required",
            extra_data={"selection_source_ref": f"{marker['type']}:{marker['id']}", "selection_decision": "green_light"},
        )
        db.add(item)
    else:
        item.pipeline_stage = "content_required"
        item.platform = item.platform or product_context.get("target_platform")
        item.market = item.market or product_context.get("target_market")
        extra = dict(item.extra_data or {})
        extra["selection_decision"] = "green_light"
        item.extra_data = extra
    await db.commit()
    await db.refresh(item)
    return {"id": item.id, "product_name": item.product_name, "route": "/content"}


def _avg_price(price_min: Optional[float], price_max: Optional[float]) -> Optional[float]:
    prices = [price for price in (price_min, price_max) if price is not None]
    return round(sum(prices) / len(prices), 2) if prices else None


def _object_ref_label(object_refs: list[dict]) -> Optional[str]:
    for item in object_refs:
        if item.get("label"):
            return str(item["label"])
    return None


def _trending_product_snapshot(product) -> dict:
    return {
        "id": product.id,
        "platform": product.platform,
        "platform_product_id": product.platform_product_id,
        "name": product.name,
        "price_min": product.price_min,
        "price_max": product.price_max,
        "sales_volume": product.sales_volume,
        "sales_growth_rate": product.sales_growth_rate,
        "category_path": product.category_path,
        "market": product.market,
        "tags": product.tags,
    }


# Compatibility export for callers that imported this endpoint before the
# trending routes were split out of this module.
from app.api.v1.scout_trending import list_captured_trending_products  # noqa: E402,F401

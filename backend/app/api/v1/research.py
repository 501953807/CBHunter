from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.competitor_product import CompetitorProduct
from app.models.market_research import MarketResearch
from app.models.trending_product import TrendingProduct
from app.models.user import User
from app.schemas.research import (
    KeywordResearchResult, SavedResearchResponse, SavedResearchCreate,
    CompetitorCreate, CompetitorResponse, TrendingProductResponse,
    TrendingProductCreate, SyncStats,
)
from app.schemas.common import ApiResponse
from app.services.research_service import (
    search_keywords, save_keyword, get_saved_keywords, delete_saved_keyword,
    get_trending_products, create_competitor, list_competitors, delete_competitor,
)
from app.services.trending_sync_service import (
    sync_trending_products as run_sync,
    add_manual_product,
    delete_trending_product,
    get_trending_products_paginated,
)
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import configuration_required, source_ref

router = APIRouter(prefix="/research", tags=["research"])


@router.get("/keywords", response_model=ApiResponse)
async def keyword_search(
    q: str = Query(min_length=1),
    platform: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await search_keywords(q, platform)
    if result.get("data_source") == "not_configured":
        missing = configuration_required(
            "真实关键词数据源尚未配置；当前只保留查询词，不生成搜索量、竞争度或趋势数据。",
            data_gaps=["keyword_data_source"],
            source_refs=[source_ref("keyword_query", q, label=platform)],
            evidence_window="当前关键词查询请求",
        )
        return ApiResponse(
            data=KeywordResearchResult(**result),
            status=missing["status"], source_refs=missing["source_refs"], evidence_window=missing["evidence_window"],
            confidence_reason=missing["confidence_reason"], data_gaps=missing["data_gaps"],
        )
    return ApiResponse(
        data=KeywordResearchResult(**result), status="ready",
        source_refs=[source_ref("keyword_query", q, label=platform)], evidence_window="当前关键词查询请求",
        confidence_reason="关键词指标来自已配置真实数据源。", data_gaps=[],
    )


@router.get("/saved", response_model=ApiResponse)
async def list_saved(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    records = await get_saved_keywords(db, current_user.id)
    gaps = [] if records else ["暂无已保存关键词研究"]
    if records and any(item.search_volume is None for item in records):
        gaps.append("部分研究记录缺少真实搜索量")
    return ApiResponse(
        data=[SavedResearchResponse.model_validate(r) for r in records],
        status="ready" if records else "data_required",
        source_refs=[source_ref("market_research", item.id, label=item.keyword) for item in records],
        evidence_window="当前用户已保存关键词研究",
        confidence_reason="研究收藏仅展示当前用户已持久化记录；缺失指标不使用模拟值补齐。",
        data_gaps=gaps,
    )


@router.post("/saved", response_model=ApiResponse)
async def save_research(
    req: SavedResearchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await search_keywords(req.keyword, req.platform)
    try:
        record = await save_keyword(db, current_user.id, req.keyword, req.platform, result)
        await record_audit_event(
            db,
            user=current_user,
            action="create",
            resource_type="market_research",
            resource_id=record.id,
            new_value=_market_research_snapshot(record),
            detail="保存关键词研究记录",
        )
        return ApiResponse(data=SavedResearchResponse.model_validate(record))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete("/saved/{record_id}", response_model=ApiResponse)
async def delete_saved(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await _get_market_research(db, record_id, current_user.id)
    if not record:
        raise HTTPException(status_code=404, detail="Research not found")
    old_value = _market_research_snapshot(record)
    await delete_saved_keyword(db, record_id, current_user.id)
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="market_research",
        resource_id=record_id,
        old_value=old_value,
        detail="删除关键词研究记录",
    )
    return ApiResponse(data={"message": "Research deleted"})


@router.get("/trending", response_model=ApiResponse)
async def trending_products(
    platform: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    products = await get_trending_products(db, current_user.id, platform)
    category_labels = {
        item["id"]: item["label"]
        for item in await config_service.get_categories(db)
    }
    data = []
    for p in products:
        d = TrendingProductResponse.model_validate(p).model_dump()
        d["category_label"] = category_labels.get(d.get("category_path"), d.get("category_path"))
        data.append(d)
    return ApiResponse(data=data)


@router.post("/trending/sync", response_model=ApiResponse)
async def sync_trending(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-sync trending products from all platforms."""
    stats = await run_sync(db, current_user.id)
    await record_audit_event(
        db,
        user=current_user,
        action="sync",
        resource_type="research_trending_product",
        resource_id="all",
        new_value=stats,
        detail="老研究模块同步热卖商品",
    )
    return ApiResponse(data=SyncStats(**stats))


@router.post("/trending", response_model=ApiResponse)
async def create_trending_product(
    req: TrendingProductCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually add a trending product."""
    tags = [req.market] if req.market else None
    product = await add_manual_product(
        db, current_user.id,
        platform=req.platform,
        name=req.name,
        price_min=req.price_min,
        price_max=req.price_max,
        sales_volume=req.sales_volume,
        sales_growth_rate=req.sales_growth_rate,
        category_path=req.category_path,
        tags=tags,
    )
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="research_trending_product",
        resource_id=product.id,
        new_value=_trending_snapshot(product),
        detail="老研究模块手工新增热卖商品",
    )
    category_labels = {
        item["id"]: item["label"]
        for item in await config_service.get_categories(db)
    }
    d = TrendingProductResponse.model_validate(product).model_dump()
    d["category_label"] = category_labels.get(d.get("category_path"), d.get("category_path"))
    return ApiResponse(data=d)


@router.delete("/trending/{product_id}", response_model=ApiResponse)
async def remove_trending_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await _get_trending_product(db, product_id, current_user.id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    old_value = _trending_snapshot(product)
    deleted = await delete_trending_product(db, product_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="research_trending_product",
        resource_id=product_id,
        old_value=old_value,
        detail="老研究模块删除热卖商品",
    )
    return ApiResponse(data={"message": "Deleted"})


@router.get("/competitors", response_model=ApiResponse)
async def list_competitors_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comps = await list_competitors(db, current_user.id)
    return ApiResponse(data=[CompetitorResponse.model_validate(c) for c in comps])


@router.post("/competitors", response_model=ApiResponse)
async def add_competitor(
    req: CompetitorCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comp = await create_competitor(db, current_user.id, req.model_dump())
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="competitor_product",
        resource_id=comp.id,
        new_value=_competitor_snapshot(comp),
        detail="添加竞品追踪",
    )
    return ApiResponse(data=CompetitorResponse.model_validate(comp))


@router.delete("/competitors/{comp_id}", response_model=ApiResponse)
async def remove_competitor(
    comp_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CompetitorProduct).where(
            CompetitorProduct.id == comp_id,
            CompetitorProduct.user_id == current_user.id,
        )
    )
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")
    old_value = _competitor_snapshot(comp)
    await delete_competitor(db, comp_id, current_user.id)
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="competitor_product",
        resource_id=comp_id,
        old_value=old_value,
        detail="取消竞品追踪",
    )
    return ApiResponse(data={"message": "Competitor removed"})


def _competitor_snapshot(comp: CompetitorProduct) -> dict:
    return {
        "id": comp.id,
        "platform": comp.platform,
        "platform_product_id": comp.platform_product_id,
        "name": comp.name,
        "seller_name": comp.seller_name,
        "price": comp.price,
        "url": comp.url,
        "is_tracked": comp.is_tracked,
    }


async def _get_market_research(db: AsyncSession, record_id: str, user_id: str) -> Optional[MarketResearch]:
    result = await db.execute(
        select(MarketResearch).where(
            MarketResearch.id == record_id,
            MarketResearch.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _get_trending_product(db: AsyncSession, product_id: str, user_id: str) -> Optional[TrendingProduct]:
    result = await db.execute(
        select(TrendingProduct).where(
            TrendingProduct.id == product_id,
            TrendingProduct.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def _market_research_snapshot(record: MarketResearch) -> dict:
    return {
        "id": record.id,
        "keyword": record.keyword,
        "platform": record.platform,
        "search_volume": record.search_volume,
        "competition_level": record.competition_level,
        "avg_price": record.avg_price,
        "total_results": record.total_results,
        "related_keywords": record.related_keywords,
        "trend_data": record.trend_data,
        "analyzed_at": record.analyzed_at,
    }


def _trending_snapshot(product: TrendingProduct) -> dict:
    return {
        "id": product.id,
        "platform": product.platform,
        "platform_product_id": product.platform_product_id,
        "name": product.name,
        "price_min": product.price_min,
        "price_max": product.price_max,
        "price_cny": product.price_cny,
        "sales_volume": product.sales_volume,
        "sales_growth_rate": product.sales_growth_rate,
        "category_path": product.category_path,
        "market": product.market,
        "product_url": product.product_url,
        "shop_name": product.shop_name,
        "rating": product.rating,
        "tags": product.tags,
        "snapshot_data": product.snapshot_data,
    }

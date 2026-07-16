"""Hot product browsing and capture APIs under /scout."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete as sql_delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.captured_trending_product import CapturedTrendingProduct
from app.models.trending_product import TrendingProduct
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/scout", tags=["scout"])


@router.get("/trending-products", response_model=ApiResponse)
async def list_trending_products(
    platform: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    market: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List trending products with optional filters."""
    base_filters = [TrendingProduct.user_id == current_user.id]
    if keyword:
        base_filters.append(
            or_(
                TrendingProduct.name.ilike(f"%{keyword}%"),
                TrendingProduct.category_path.ilike(f"%{keyword}%"),
            )
        )
    if category:
        base_filters.append(TrendingProduct.category_path == category)
    if market:
        base_filters.append(TrendingProduct.market == market)

    platform_counts_result = await db.execute(
        select(TrendingProduct.platform, func.count(TrendingProduct.id))
        .where(*base_filters)
        .group_by(TrendingProduct.platform)
    )
    platform_counts = {
        platform_name: count
        for platform_name, count in platform_counts_result.all()
        if platform_name
    }

    query = select(TrendingProduct).where(*base_filters).order_by(
        TrendingProduct.sales_volume.desc().nullslast()
    )
    if platform:
        query = query.where(TrendingProduct.platform == platform.lower())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    products = result.scalars().all()

    items = []
    for product in products:
        snapshot = product.snapshot_data or {}
        items.append({
            "id": product.id,
            "platform": product.platform,
            "name": product.name,
            "sku": getattr(product, "sku", "") or product.platform_product_id or "",
            "price_min": product.price_min,
            "price_max": product.price_max,
            "price_cny": getattr(product, "price_cny", None),
            "sales_volume": product.sales_volume,
            "sales_growth_rate": product.sales_growth_rate,
            "category_path": product.category_path,
            "market": getattr(product, "market", "") or snapshot.get("market", ""),
            "images": getattr(product, "images", []) or [],
            "product_url": getattr(product, "product_url", "") or "",
            "shop_name": getattr(product, "shop_name", "") or "",
            "rating": getattr(product, "rating", None),
            "tags": product.tags or [],
            "source": snapshot.get("source") or "unknown",
            "discovered_at": product.discovered_at.isoformat() if product.discovered_at else None,
            "last_updated": product.last_updated.isoformat() if product.last_updated else None,
        })

    gaps = []
    if any(item["price_min"] is None and item["price_max"] is None for item in items):
        gaps.append("部分热卖商品缺价格")
    if any(item["sales_volume"] is None for item in items):
        gaps.append("部分热卖商品缺销量")
    return ApiResponse(data={
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "platform_counts": platform_counts,
    }, status="ready" if items else "data_required",
        source_refs=[source_ref("trending_product", item["id"], label=item["name"], meta={"source": item["source"]}) for item in items],
        evidence_window="当前用户热卖商品采集快照",
        confidence_reason="商品字段保持各采集来源原值；缺价格或销量时不补默认值。",
        data_gaps=gaps if items else ["暂无热卖商品采集记录"],
    )


@router.post("/trending-products/sync", response_model=ApiResponse)
async def sync_trending_products(
    platform: str = Query("all"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync trending products from specified platform."""
    from app.services.trending_sync_service import sync_trending_products as do_sync

    if platform == "all":
        stats = await do_sync(db, current_user.id)
    else:
        stats = {"errors": []}
        if platform == "shopee":
            from app.services.trending_sync_service import fetch_shopee_trending
            stats["shopee"] = await fetch_shopee_trending(db, current_user.id)
        elif platform == "temu":
            from app.services.trending_sync_service import fetch_temu_trending
            stats["temu"] = await fetch_temu_trending(db, current_user.id)
        elif platform == "tiktok":
            from app.services.trending_sync_service import fetch_tiktok_trending
            stats["tiktok"] = await fetch_tiktok_trending(db, current_user.id)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")
        stats["total"] = sum(value for value in stats.values() if isinstance(value, int))

    await record_audit_event(
        db,
        user=current_user,
        action="sync",
        resource_type="trending_product",
        resource_id=platform,
        new_value=stats,
        detail="同步平台热卖商品",
    )
    errors = stats.get("errors") or []
    synced = int(stats.get("total") or 0)
    return ApiResponse(
        data=stats,
        status="ready" if synced > 0 and not errors else "data_required",
        source_refs=[source_ref("trending_sync", platform, meta={"records_synced": synced})],
        evidence_window="本次热卖来源同步执行窗口",
        confidence_reason="同步计数来自本次实际写入记录；来源不可用时不插入后备商品。",
        data_gaps=errors or ([] if synced > 0 else ["本次未同步到热卖商品"]),
    )


@router.delete("/trending-products/{product_id}", response_model=ApiResponse)
async def delete_trending_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a trending product."""
    from app.services.trending_sync_service import delete_trending_product as do_delete

    product = await _get_trending_product(db, product_id, current_user.id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    old_value = _trending_snapshot(product)
    ok = await do_delete(db, product_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Product not found")
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="trending_product",
        resource_id=product_id,
        old_value=old_value,
        detail="删除平台热卖商品",
    )
    return ApiResponse(data={"message": "已删除"})


@router.post("/trending-products/capture", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def capture_trending_product(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Capture a trending product from hot list into user's captured list."""
    src_id = data.get("trending_id") or data.get("id")
    if not src_id:
        raise HTTPException(status_code=400, detail="缺少 trending_id")

    result = await db.execute(
        select(TrendingProduct).where(
            TrendingProduct.id == src_id,
            TrendingProduct.user_id == current_user.id,
        )
    )
    src = result.scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="商品不存在")

    existing = await db.execute(
        select(CapturedTrendingProduct).where(
            CapturedTrendingProduct.user_id == current_user.id,
            CapturedTrendingProduct.platform_product_id == src.platform_product_id,
            CapturedTrendingProduct.platform == src.platform,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="已加入备选")

    now = datetime.now(timezone.utc)
    captured = CapturedTrendingProduct(
        user_id=current_user.id,
        platform=src.platform,
        platform_product_id=src.platform_product_id,
        name=src.name,
        price_min=src.price_min,
        price_max=src.price_max,
        price_cny=src.price_cny,
        sales_volume=src.sales_volume,
        sales_growth_rate=src.sales_growth_rate,
        category_path=src.category_path,
        market=src.market or data.get("market", ""),
        images=src.images or [],
        sku=src.sku or "",
        product_url=src.product_url or data.get("product_url", ""),
        shop_name=src.shop_name or "",
        rating=src.rating,
        tags=(src.tags or []) + (data.get("tags") or []),
        snapshot_data={"source": "captured_from_hot"},
        discovered_at=now,
        last_updated=now,
    )
    db.add(captured)
    await db.commit()
    await db.refresh(captured)
    await record_audit_event(
        db,
        user=current_user,
        action="capture",
        resource_type="captured_trending_product",
        resource_id=captured.id,
        old_value=_trending_snapshot(src),
        new_value=_captured_trending_snapshot(captured),
        detail="捕获热卖商品到备选库",
    )
    return ApiResponse(data={"id": captured.id, "message": "已加入备选"})


@router.get("/captured-trending-products", response_model=ApiResponse)
async def list_captured_trending_products(
    platform: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List captured trending products."""
    query = select(CapturedTrendingProduct).where(
        CapturedTrendingProduct.user_id == current_user.id
    ).order_by(CapturedTrendingProduct.last_updated.desc().nullslast())
    if platform:
        query = query.where(CapturedTrendingProduct.platform == platform.lower())
    if keyword:
        query = query.where(
            or_(
                CapturedTrendingProduct.name.ilike(f"%{keyword}%"),
                CapturedTrendingProduct.category_path.ilike(f"%{keyword}%"),
            )
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    products = result.scalars().all()

    items = [_serialize_captured(product) for product in products]
    gaps = []
    if any(item["price_min"] is None and item["price_max"] is None for item in items):
        gaps.append("部分备选商品缺价格")
    if any(item["sales_volume"] is None for item in items):
        gaps.append("部分备选商品缺销量")
    return ApiResponse(
        data={"items": items, "total": total}, status="ready" if items else "data_required",
        source_refs=[source_ref("captured_trending_product", item["id"], label=item["name"], meta={"source": item["source"]}) for item in items],
        evidence_window="当前用户热卖备选库",
        confidence_reason="备选商品来自已保存采集记录或用户手工录入，未知字段保持为空。",
        data_gaps=gaps if items else ["暂无热卖备选商品"],
    )


@router.delete("/captured-trending-products/{product_id}", response_model=ApiResponse)
async def delete_captured_trending_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a captured trending product."""
    existing = await _get_captured_trending_product(db, product_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    old_value = _captured_trending_snapshot(existing)
    result = await db.execute(
        sql_delete(CapturedTrendingProduct).where(
            CapturedTrendingProduct.id == product_id,
            CapturedTrendingProduct.user_id == current_user.id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="captured_trending_product",
        resource_id=product_id,
        old_value=old_value,
        detail="删除备选热卖商品",
    )
    return ApiResponse(data={"message": "已删除"})


def _serialize_captured(product) -> dict:
    snapshot = product.snapshot_data or {}
    return {
        "id": product.id,
        "platform": product.platform,
        "name": product.name,
        "sku": product.sku or product.platform_product_id or "",
        "price_min": product.price_min,
        "price_max": product.price_max,
        "price_cny": product.price_cny,
        "sales_volume": product.sales_volume,
        "sales_growth_rate": product.sales_growth_rate,
        "category_path": product.category_path,
        "market": product.market or "",
        "images": product.images or [],
        "product_url": product.product_url or "",
        "shop_name": product.shop_name or "",
        "rating": product.rating,
        "tags": product.tags or [],
        "snapshot_data": snapshot,
        "source": snapshot.get("source") or "captured",
    }


async def _get_trending_product(db: AsyncSession, product_id: str, user_id: str) -> Optional[TrendingProduct]:
    result = await db.execute(
        select(TrendingProduct).where(
            TrendingProduct.id == product_id,
            TrendingProduct.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _get_captured_trending_product(
    db: AsyncSession,
    product_id: str,
    user_id: str,
) -> Optional[CapturedTrendingProduct]:
    result = await db.execute(
        select(CapturedTrendingProduct).where(
            CapturedTrendingProduct.id == product_id,
            CapturedTrendingProduct.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


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


def _captured_trending_snapshot(product: CapturedTrendingProduct) -> dict:
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

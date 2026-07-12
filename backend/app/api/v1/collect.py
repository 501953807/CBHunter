"""Browser extension collection endpoints — receives data from Chrome Extension."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.api.v1.response_helpers import evidence_response
from app.services.evidence_service import data_required, source_ref
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/collect", tags=["collect"])


# ══════════════════════════════════════════
# Unified product collection (Chrome extension v0.4+)
# ══════════════════════════════════════════

class UnifiedCollectRequest(BaseModel):
    source_platform: str  # shopee|temu|tiktok|ali1688
    source_url: str
    title: str
    price: Optional[float] = None
    currency: str
    images: list[str] = Field(default_factory=list)
    extra: dict = Field(default_factory=dict)


@router.post("/product", response_model=ApiResponse, status_code=201)
async def collect_product_unified(
    req: UnifiedCollectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unified endpoint: receive normalized product data from Chrome extension.

    Auto-routes to correct table and handles dedup by source_url.
    """
    from app.models.trending_product import TrendingProduct
    from app.models.supply_product import SupplyProduct
    from sqlalchemy import select

    # Dedup: check if this URL was already collected
    existing = await db.execute(
        select(TrendingProduct).where(
            TrendingProduct.user_id == current_user.id,
            TrendingProduct.product_url == req.source_url,
        )
    )
    existing_tp = existing.scalar_one_or_none()
    if existing_tp:
        return ApiResponse(data={
            "id": existing_tp.id, "product_name": existing_tp.name,
            "status": "already_exists", "routed_to": "trending_product",
        })

    existing_sp = await db.execute(
        select(SupplyProduct).where(
            SupplyProduct.user_id == current_user.id,
            SupplyProduct.product_url == req.source_url,
        )
    )
    existing_supply_product = existing_sp.scalar_one_or_none()
    if existing_supply_product:
        return ApiResponse(data={
            "id": existing_supply_product.id,
            "status": "already_exists", "routed_to": "supply_product",
        })

    now = datetime.now(timezone.utc)
    source_platform = _normalize_source_platform(req.source_platform)
    market = req.extra.get("market")
    product_identity = _extension_product_identity(req.extra, source_platform, now)
    snapshot_data = _extension_snapshot(req, source_platform)

    # Route 1688 → SupplyProduct, others → TrendingProduct
    if source_platform == 'ali1688':
        missing = _missing_fields({
            "source_url": req.source_url,
            "title": req.title,
            "price": req.price,
        })
        if missing:
            return evidence_response(data_required(
                "1688 商品采集缺少来源链接、标题或真实价格，未写入品源库",
                data_gaps=missing,
                source_refs=[source_ref("collection_request", source_platform, field="source_platform")],
                evidence_window="浏览器扩展当前采集结果",
            ))
        sp = SupplyProduct(
            user_id=current_user.id, platform="ali1688",
            platform_product_id=product_identity,
            name=req.title, price_min=req.price, price_max=req.price,
            price_range_text=req.extra.get("price_range_text", ""), sales_volume=req.extra.get("sales"),
            category_path=req.extra.get("category_path", ""),
            shop_name=req.extra.get("supplier_name", ""),
            shop_url=req.extra.get("shop_url", ""),
            supplier_rating=req.extra.get("supplier_rating", ""),
            product_url=req.source_url, images=req.images,
            sku=req.extra.get("sku", ""), moq=req.extra.get("moq") or req.extra.get("min_order"),
            rating=req.extra.get("rating"),
            tags=[], market="CN", source="browser_ext_unified",
            snapshot_data=snapshot_data,
            discovered_at=now, last_updated=now,
        )
        db.add(sp)
        await db.commit()
        await db.refresh(sp)
        await record_audit_event(
            db,
            user=current_user,
            action="collect",
            resource_type="supply_product",
            resource_id=sp.id,
            new_value=_supply_product_snapshot(sp),
            detail="浏览器扩展统一采集 1688 品源商品",
        )
        return ApiResponse(data={"id": sp.id, "product_name": sp.name, "routed_to": "supply_product", "status": "created"})

    from app.services.config_service import get_platforms
    approved_platforms = {item["id"] for item in await get_platforms(db)}
    if source_platform not in approved_platforms:
        raise HTTPException(400, "仅支持配置中的 Shopee、TEMU、TikTok Shop 平台")

    missing = _missing_fields({
        "source_url": req.source_url,
        "title": req.title,
        "market": market,
    })
    if missing:
        return evidence_response(data_required(
            "平台商品采集缺少来源链接、标题或目标市场，未写入热卖商品库",
            data_gaps=missing,
            source_refs=[source_ref("collection_request", source_platform, field="source_platform")],
            evidence_window="浏览器扩展当前采集结果",
        ))

    tp = TrendingProduct(
        user_id=current_user.id,
        platform=source_platform,
        platform_product_id=product_identity,
        name=req.title,
        price_min=req.price, price_max=req.price,
        price_cny=req.price if req.currency == 'CNY' else None,
        sales_volume=req.extra.get("sales"),
        category_path=req.extra.get("category_path", ""),
        market=market, images=req.images,
        product_url=req.source_url,
        shop_name=req.extra.get("shop_name", ""),
        rating=req.extra.get("rating"),
        tags=[], snapshot_data=snapshot_data,
        discovered_at=now, last_updated=now,
    )
    db.add(tp)
    await db.commit()
    await db.refresh(tp)
    await record_audit_event(
        db,
        user=current_user,
        action="collect",
        resource_type="trending_product",
        resource_id=tp.id,
        new_value=_trending_product_snapshot(tp),
        detail="浏览器扩展统一采集平台商品",
    )
    return ApiResponse(data={"id": tp.id, "product_name": tp.name, "routed_to": "trending_product", "status": "created"})

class CollectHotProductRequest(BaseModel):
    platform: str  # shopee, temu, tiktok, ali1688
    market: str
    product_name: str
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    sales_volume: Optional[int] = None
    sales_growth_rate: Optional[float] = None
    category_path: Optional[str] = None
    product_url: Optional[str] = None
    image_url: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    # Extended fields from browser extension
    images: list[str] = Field(default_factory=list)
    sku: Optional[str] = None
    shop_name: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    product_id: Optional[str] = None
    shop_url: Optional[str] = None
    supplier_rating: Optional[str] = None
    price_range_text: Optional[str] = None
    moq: Optional[int] = None
    extra_data: dict = Field(default_factory=dict)


class CollectToSourcingRequest(BaseModel):
    source_name: str = "browser_ext"
    source_type: str = "browser_ext"
    product_name: str
    product_name_cn: Optional[str] = None
    category: Optional[str] = None
    platform: Optional[str] = None
    market: Optional[str] = None
    source_price_rmb: float = Field(gt=0)
    source_url: Optional[str] = None
    source_image: Optional[str] = None
    notes: Optional[str] = None
    extra_data: Optional[dict] = None


class CollectCultureSignalRequest(BaseModel):
    title: str
    content: Optional[str] = None
    source_url: Optional[str] = None
    source: str = "browser_ext"


class CollectSupplierRequest(BaseModel):
    sourcing_item_id: Optional[str] = None
    supplier_name: str
    product_name: Optional[str] = None
    purchase_price_rmb: Optional[float] = None
    supplier_url: Optional[str] = None
    product_image: Optional[str] = None
    moq: Optional[int] = None
    rating: Optional[str] = None
    shipping_estimate_rmb: Optional[float] = None
    notes: Optional[str] = None


class CollectSuppliersBatchRequest(BaseModel):
    items: list[CollectSupplierRequest]


class CollectProductImageRequest(BaseModel):
    image_url: str
    source_url: Optional[str] = None
    category: Optional[str] = None
    market: Optional[str] = None
    notes: Optional[str] = None


@router.post("/hot-product", response_model=ApiResponse, status_code=201)
async def collect_hot_product(
    req: CollectHotProductRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extension: collect a trending product from Shopee/TEMU/TikTok Shop/1688.
    
    1688 (ali1688) products are routed to SupplyProduct table for the supply chain view.
    """
    from app.models.trending_product import TrendingProduct
    from app.models.supply_product import SupplyProduct

    now = datetime.now(timezone.utc)

    # 1688 products → SupplyProduct table (no currency conversion, price already CNY)
    if req.platform == 'ali1688':
        missing = _missing_fields({
            "product_url": req.product_url,
            "product_name": req.product_name,
            "price_min_or_price_max": req.price_min if req.price_min is not None else req.price_max,
        })
        if missing:
            return evidence_response(data_required(
                "1688 热卖采集缺少商品链接、名称或真实价格，未写入品源库",
                data_gaps=missing,
                source_refs=[source_ref("collection_request", "ali1688", field="platform")],
                evidence_window="浏览器扩展当前采集结果",
            ))
        sp = SupplyProduct(
            user_id=current_user.id,
            platform="ali1688",
            platform_product_id=req.product_id or f"1688_{now.timestamp()}",
            name=req.product_name,
            price_min=req.price_min,
            price_max=req.price_max,
            price_range_text=req.price_range_text or "",
            sales_volume=req.sales_volume,
            category_path=req.category_path or "",
            shop_name=req.shop_name or "",
            shop_url=req.shop_url or "",
            supplier_rating=req.supplier_rating or "",
            product_url=req.product_url or "",
            images=req.images or [],
            sku=req.sku or "",
            moq=req.moq,
            rating=req.rating,
            tags=req.tags or [],
            market=req.market or "CN",
            source="browser_ext",
            snapshot_data=_hot_product_snapshot(req, "ali1688"),
            discovered_at=now,
            last_updated=now,
        )
        db.add(sp)
        await db.commit()
        await db.refresh(sp)
        await record_audit_event(
            db,
            user=current_user,
            action="collect",
            resource_type="supply_product",
            resource_id=sp.id,
            new_value=_supply_product_snapshot(sp),
            detail="浏览器扩展采集 1688 热卖商品",
        )
        return ApiResponse(data={"id": sp.id, "product_name": sp.name, "routed_to": "supply_chain"})

    from app.services.config_service import get_platforms
    approved_platforms = {item["id"] for item in await get_platforms(db)}
    if req.platform not in approved_platforms:
        raise HTTPException(400, "仅支持配置中的 Shopee、TEMU、TikTok Shop 平台")

    missing = _missing_fields({
        "product_url": req.product_url,
        "product_name": req.product_name,
        "market": req.market,
    })
    if missing:
        return evidence_response(data_required(
            "平台热卖采集缺少商品链接、名称或目标市场，未写入热卖商品库",
            data_gaps=missing,
            source_refs=[source_ref("collection_request", req.platform, field="platform")],
            evidence_window="浏览器扩展当前采集结果",
        ))

    product = TrendingProduct(
        user_id=current_user.id,
        platform=req.platform,
        platform_product_id=req.product_id or f"ext_{now.timestamp()}",
        name=req.product_name,
        price_min=req.price_min,
        price_max=req.price_max,
        price_cny=None,
        sales_volume=req.sales_volume,
        sales_growth_rate=req.sales_growth_rate,
        category_path=req.category_path or "",
        market=req.market,
        images=req.images or [],
        sku=req.sku or "",
        product_url=req.product_url or "",
        shop_name=req.shop_name or "",
        rating=req.rating,
        tags=req.tags or [],
        snapshot_data=_hot_product_snapshot(req, req.platform),
        discovered_at=now,
        last_updated=now,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await record_audit_event(
        db,
        user=current_user,
        action="collect",
        resource_type="trending_product",
        resource_id=product.id,
        new_value=_trending_product_snapshot(product),
        detail="浏览器扩展采集平台热卖商品",
    )
    return ApiResponse(data={"id": product.id, "product_name": product.name})


@router.post("/to-sourcing", response_model=ApiResponse, status_code=201)
async def collect_to_sourcing(
    req: CollectToSourcingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extension: directly add a product to the sourcing library."""
    from app.services.sourcing_service import create_item

    item = await create_item(db, current_user.id, {
        "source_name": req.source_name,
        "source_url": req.source_url,
        "source_image": req.source_image,
        "source_price_rmb": req.source_price_rmb,
        "product_name": req.product_name,
        "product_name_cn": req.product_name_cn or req.product_name,
        "category": req.category,
        "platform": req.platform,
        "market": req.market,
        "pipeline_stage": "discovery",
        "notes": req.notes or "来自浏览器扩展",
        "extra_data": req.extra_data or {},
    })
    await record_audit_event(
        db,
        user=current_user,
        action="collect",
        resource_type="sourcing_item",
        resource_id=item.id,
        new_value=_sourcing_item_snapshot(item),
        detail="浏览器扩展直接加入选品库",
    )
    return ApiResponse(data={"id": item.id, "product_name": item.product_name})


@router.post("/culture-signal", response_model=ApiResponse, status_code=201)
async def collect_culture_signal(
    req: CollectCultureSignalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extension: save a page as a culture signal."""
    from app.services.signal_service import create_signal as db_create_signal

    signal = await db_create_signal(db, current_user.id, {
        "layer": "culture",
        "source": req.source,
        "title": req.title,
        "content": req.content,
        "source_url": req.source_url,
    })
    await record_audit_event(
        db,
        user=current_user,
        action="collect",
        resource_type="signal",
        resource_id=signal.id,
        new_value=_signal_snapshot(signal),
        detail="浏览器扩展采集社交舆论信号",
    )
    return ApiResponse(data={"id": signal.id, "title": signal.title})


@router.post("/supplier", response_model=ApiResponse, status_code=201)
async def collect_supplier(
    req: CollectSupplierRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extension: add a supplier from 1688 product page."""
    from app.services.supplier_service import create_supplier
    from app.models.sourcing_item import SourcingItem
    from sqlalchemy import select

    # If no sourcing_item_id, create a new sourcing item first
    sourcing_item_id = req.sourcing_item_id
    if not sourcing_item_id and req.product_name:
        if req.purchase_price_rmb is None or req.purchase_price_rmb <= 0:
            raise HTTPException(400, "新建选品时必须提供真实采购价")
        from app.services.sourcing_service import create_item
        item = await create_item(db, current_user.id, {
            "source_name": "ali1688",
            "product_name": req.product_name,
            "source_price_rmb": req.purchase_price_rmb,
            "pipeline_stage": "discovery",
            "notes": req.notes or "从1688采集",
        })
        sourcing_item_id = item.id
        await record_audit_event(
            db,
            user=current_user,
            action="collect",
            resource_type="sourcing_item",
            resource_id=item.id,
            new_value=_sourcing_item_snapshot(item),
            detail="浏览器扩展采集供应商时自动创建选品",
        )

    if not sourcing_item_id:
        raise HTTPException(400, "sourcing_item_id 或 product_name 必填")
    await _ensure_sourcing_item_owner(db, sourcing_item_id, current_user.id)

    supplier = await create_supplier(db, current_user.id, {
        "sourcing_item_id": sourcing_item_id,
        "supplier_name": req.supplier_name,
        "purchase_price_rmb": req.purchase_price_rmb,
        "supplier_url": req.supplier_url,
        "product_image": req.product_image,
        "moq": req.moq,
        "rating": req.rating,
        "shipping_estimate_rmb": req.shipping_estimate_rmb,
        "notes": req.notes,
    })
    await record_audit_event(
        db,
        user=current_user,
        action="collect",
        resource_type="sourcing_supplier",
        resource_id=supplier.id,
        new_value=_supplier_snapshot(supplier),
        detail="浏览器扩展采集 1688 供应商",
    )
    return ApiResponse(data={
        "id": supplier.id,
        "supplier_name": supplier.supplier_name,
        "sourcing_item_id": sourcing_item_id,
    })


@router.post("/suppliers-batch", response_model=ApiResponse, status_code=201)
async def collect_suppliers_batch(
    req: CollectSuppliersBatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extension: batch add suppliers from 1688 search results."""
    from app.services.supplier_service import create_supplier

    results = []
    for item in req.items:
        sid = item.sourcing_item_id
        if not sid and item.product_name:
            if item.purchase_price_rmb is None or item.purchase_price_rmb <= 0:
                results.append({
                    "supplier_name": item.supplier_name,
                    "status": "skipped",
                    "error": "新建选品时缺少真实采购价",
                })
                continue
            from app.services.sourcing_service import create_item
            new_item = await create_item(db, current_user.id, {
                "source_name": "ali1688",
                "product_name": item.product_name,
                "source_price_rmb": item.purchase_price_rmb,
            })
            sid = new_item.id
            await record_audit_event(
                db,
                user=current_user,
                action="collect",
                resource_type="sourcing_item",
                resource_id=new_item.id,
                new_value=_sourcing_item_snapshot(new_item),
                detail="批量采集供应商时自动创建选品",
            )

        if sid:
            await _ensure_sourcing_item_owner(db, sid, current_user.id)
            s = await create_supplier(db, current_user.id, {
                "sourcing_item_id": sid,
                "supplier_name": item.supplier_name,
                "purchase_price_rmb": item.purchase_price_rmb,
                "supplier_url": item.supplier_url,
                "product_image": item.product_image,
                "moq": item.moq,
                "rating": item.rating,
                "notes": item.notes,
            })
            results.append({"id": s.id, "supplier_name": s.supplier_name})
            await record_audit_event(
                db,
                user=current_user,
                action="collect",
                resource_type="sourcing_supplier",
                resource_id=s.id,
                new_value=_supplier_snapshot(s),
                detail="浏览器扩展批量采集 1688 供应商",
            )

    return ApiResponse(data={"count": len(results), "suppliers": results})


@router.post("/product-image", response_model=ApiResponse, status_code=201)
async def collect_product_image(
    req: CollectProductImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extension: send an image (right-click) to product discovery for AI analysis."""
    from app.services.discovery_service import create_discovery

    discovery = await create_discovery(db, current_user.id, {
        "source_type": "browser_ext",
        "source_image": req.image_url,
        "source_url": req.source_url,
        "category": req.category,
        "market": req.market,
        "notes": req.notes or "来自浏览器扩展",
        "status": "discovered",
    })
    await record_audit_event(
        db,
        user=current_user,
        action="collect",
        resource_type="product_discovery",
        resource_id=discovery.id,
        new_value=_discovery_snapshot(discovery),
        detail="浏览器扩展采集商品图片到选品发现",
    )
    return ApiResponse(data={"id": discovery.id, "status": "discovered"})



# ══════════════════════════════════════════
# Supply Chain Collection (1688)
# ══════════════════════════════════════════

class CollectSupplyProductRequest(BaseModel):
    product_name: str
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    price_range_text: Optional[str] = None
    sales_volume: Optional[int] = None
    category_path: Optional[str] = None
    shop_name: Optional[str] = None
    shop_url: Optional[str] = None
    supplier_rating: Optional[str] = None
    product_url: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    sku: Optional[str] = None
    moq: Optional[int] = None
    rating: Optional[float] = None
    tags: list[str] = Field(default_factory=list)
    market: str = "CN"
    notes: Optional[str] = None


@router.post("/supply-product", response_model=ApiResponse, status_code=201)
async def collect_supply_product(
    req: CollectSupplyProductRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extension: collect a 1688 supply chain product."""
    from app.models.supply_product import SupplyProduct

    missing = _missing_fields({
        "product_url": req.product_url,
        "product_name": req.product_name,
        "price_min_or_price_max": req.price_min if req.price_min is not None else req.price_max,
    })
    if missing:
        return evidence_response(data_required(
            "1688 品源采集缺少商品链接、名称或真实价格，未写入品源库",
            data_gaps=missing,
            source_refs=[source_ref("collection_request", "ali1688", field="platform")],
            evidence_window="浏览器扩展当前采集结果",
        ))

    now = datetime.now(timezone.utc)
    product = SupplyProduct(
        user_id=current_user.id,
        platform="ali1688",
        platform_product_id=f"1688_{now.timestamp()}",
        name=req.product_name,
        price_min=req.price_min,
        price_max=req.price_max,
        price_range_text=req.price_range_text or "",
        sales_volume=req.sales_volume,
        category_path=req.category_path or "",
        shop_name=req.shop_name or "",
        shop_url=req.shop_url or "",
        supplier_rating=req.supplier_rating or "",
        product_url=req.product_url or "",
        images=req.images or [],
        sku=req.sku or "",
        moq=req.moq,
        rating=req.rating,
        tags=req.tags or [],
        market=req.market or "CN",
        source="browser_ext",
        notes=req.notes or "",
        discovered_at=now,
        last_updated=now,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await record_audit_event(
        db,
        user=current_user,
        action="collect",
        resource_type="supply_product",
        resource_id=product.id,
        new_value=_supply_product_snapshot(product),
        detail="浏览器扩展采集 1688 品源商品",
    )
    return ApiResponse(data={"id": product.id, "product_name": product.name})


def _missing_fields(values: dict[str, object]) -> list[str]:
    missing = []
    for key, value in values.items():
        if value is None or value == "":
            missing.append(key)
    return missing


def _normalize_source_platform(platform: str) -> str:
    value = (platform or "").strip().lower()
    if value in {"1688", "ali1688", "alibaba1688"}:
        return "ali1688"
    if value in {"tiktok_shop", "tiktokshop"}:
        return "tiktok"
    return value


def _extension_product_identity(extra: dict, source_platform: str, now: datetime) -> str:
    for key in ("product_id", "platform_product_id", "item_id", "sku"):
        value = extra.get(key)
        if value:
            return str(value)
    prefix = "1688" if source_platform == "ali1688" else "unified"
    return f"{prefix}_{now.timestamp()}"


def _extension_snapshot(req: UnifiedCollectRequest, source_platform: str) -> dict:
    return {
        "source_platform": source_platform,
        "source_url": req.source_url,
        "currency": req.currency,
        "images": req.images,
        **(req.extra or {}),
    }


def _hot_product_snapshot(req: CollectHotProductRequest, platform: str) -> dict:
    return {
        "source_platform": platform,
        "currency": req.extra_data.get("currency"),
        "review_count": req.review_count,
        "shop_url": req.shop_url,
        "supplier_rating": req.supplier_rating,
        "price_range_text": req.price_range_text,
        **(req.extra_data or {}),
    }


async def _ensure_sourcing_item_owner(db: AsyncSession, sourcing_item_id: str, user_id: str) -> None:
    from app.models.sourcing_item import SourcingItem
    from sqlalchemy import select

    result = await db.execute(
        select(SourcingItem.id).where(
            SourcingItem.id == sourcing_item_id,
            SourcingItem.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "选品不存在或无权关联供应商")


def _trending_product_snapshot(product) -> dict:
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
        "snapshot_data": getattr(product, "snapshot_data", None),
    }


def _supply_product_snapshot(product) -> dict:
    return {
        "id": product.id,
        "platform": product.platform,
        "platform_product_id": product.platform_product_id,
        "name": product.name,
        "sku": product.sku,
        "category_path": product.category_path,
        "price_min": product.price_min,
        "price_max": product.price_max,
        "price_range_text": product.price_range_text,
        "shop_name": product.shop_name,
        "shop_url": product.shop_url,
        "supplier_rating": product.supplier_rating,
        "sales_volume": product.sales_volume,
        "moq": product.moq,
        "rating": product.rating,
        "product_url": product.product_url,
        "tags": product.tags,
        "market": product.market,
        "source": product.source,
        "is_active": product.is_active,
        "snapshot_data": product.snapshot_data,
    }


def _sourcing_item_snapshot(item) -> dict:
    return {
        "id": item.id,
        "source_name": item.source_name,
        "source_url": item.source_url,
        "source_price_rmb": item.source_price_rmb,
        "product_name": item.product_name,
        "product_name_cn": item.product_name_cn,
        "category": item.category,
        "platform": item.platform,
        "market": item.market,
        "pipeline_stage": item.pipeline_stage,
        "notes": item.notes,
        "tags": item.tags,
        "extra_data": item.extra_data,
    }


def _supplier_snapshot(supplier) -> dict:
    return {
        "id": supplier.id,
        "sourcing_item_id": supplier.sourcing_item_id,
        "supplier_name": supplier.supplier_name,
        "supplier_url": supplier.supplier_url,
        "product_image": supplier.product_image,
        "purchase_price_rmb": supplier.purchase_price_rmb,
        "shipping_estimate_rmb": supplier.shipping_estimate_rmb,
        "moq": supplier.moq,
        "rating": supplier.rating,
        "is_preferred": supplier.is_preferred,
    }


def _signal_snapshot(signal) -> dict:
    return {
        "id": signal.id,
        "layer": signal.layer,
        "source": signal.source,
        "title": signal.title,
        "source_url": signal.source_url,
        "source_image": signal.source_image,
        "analysis_status": signal.analysis_status,
    }


def _discovery_snapshot(discovery) -> dict:
    return {
        "id": discovery.id,
        "source_type": discovery.source_type,
        "source_image": discovery.source_image,
        "source_url": discovery.source_url,
        "product_name": discovery.product_name,
        "category": discovery.category,
        "market": discovery.market,
        "status": discovery.status,
        "notes": discovery.notes,
        "tags": discovery.tags,
    }

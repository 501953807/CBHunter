"""API endpoints for product sourcing pipeline."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.sourcing_item import SourcingItem
from app.schemas.common import ApiResponse
from app.schemas.sourcing import (
    SourcingItemCreate,
    SourcingItemUpdate,
    SourcingItemResponse,
    SourcingPipelineSummary,
    CostCalculationRequest,
    CostCalculationResponse,
    PurchaseLedgerRequest,
    SupplierCreate,
    SupplierResponse,
)
from app.services.sourcing_service import (
    list_items,
    create_item,
    update_item,
    delete_item,
    advance_stage,
    calculate_cost,
    get_pipeline_summary,
    record_purchase_ledger,
)
from app.services.supplier_service import list_suppliers, create_supplier, delete_supplier, search_1688_suppliers
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref


router = APIRouter(prefix="/sourcing", tags=["sourcing"])


# ========== Unified add-to-sourcing from any discovery module ==========

class FromProductRequest(BaseModel):
    """Add a product from any discovery module into the sourcing library."""
    # Source
    source_name: str = "manual"          # "trending", "recommend", "discovery", "manual"
    source_type: str = "manual"          # More specific: "trending_hot", "ai_recommend", "image_discovery", etc.

    # Product info
    product_name: str
    product_name_cn: Optional[str] = None
    category: Optional[str] = None
    platform: Optional[str] = None
    market: Optional[str] = None

    # Pricing
    source_price_rmb: Optional[float] = None
    price_min: Optional[float] = None    # For trending products price range
    price_max: Optional[float] = None

    # Metadata
    notes: Optional[str] = None
    source_url: Optional[str] = None
    source_image: Optional[str] = None
    extra_data: Optional[dict] = None


@router.post("/from-product", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def add_from_product(
    req: FromProductRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a product from any discovery module (trending/recommend/discovery) to the sourcing library."""
    avg_price = None
    if req.price_min and req.price_max:
        avg_price = (req.price_min + req.price_max) / 2
    elif req.price_min:
        avg_price = req.price_min
    elif req.price_max:
        avg_price = req.price_max

    item = await create_item(db, current_user.id, {
        "source_name": req.source_name,
        "source_url": req.source_url,
        "source_price_rmb": req.source_price_rmb or avg_price,
        "product_name": req.product_name,
        "product_name_cn": req.product_name_cn or req.product_name,
        "weight_g": None,
        "category": req.category,
        "platform": req.platform,
        "market": req.market,
        "pipeline_stage": "discovery",
        "notes": req.notes or f"来自: {req.source_type}",
        "extra_data": {
            **(req.extra_data or {}),
            "source_type": req.source_type,
        },
    })
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="sourcing_item",
        resource_id=item.id,
        new_value=_sourcing_item_snapshot(item),
        detail="从商品线索加入品源库",
    )
    return ApiResponse(data=SourcingItemResponse.model_validate(item))


@router.get("", response_model=ApiResponse)
async def list_sourcing_items(
    platform: Optional[str] = Query(None),
    pipeline_stage: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    market: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_items(
        db, current_user.id, platform, pipeline_stage, category, market, search, page, page_size
    )
    return ApiResponse(
        data=[SourcingItemResponse.model_validate(i) for i in items],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
        status="ready" if total else "data_required",
        source_refs=[source_ref("sourcing_item", item.id, label=item.product_name) for item in items],
        evidence_window=f"当前筛选第 {page} 页品源记录",
        confidence_reason="品源列表只读取当前用户已保存记录，成本、销量和利润缺失时保持为空。",
        data_gaps=[] if total else ["当前筛选下暂无品源记录"],
    )


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_sourcing_item(
    req: SourcingItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await create_item(db, current_user.id, req.model_dump())
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="sourcing_item",
        resource_id=item.id,
        new_value=_sourcing_item_snapshot(item),
        detail="创建品源记录",
    )
    return ApiResponse(data=SourcingItemResponse.model_validate(item))


@router.put("/{item_id}", response_model=ApiResponse)
async def update_sourcing_item(
    item_id: str,
    req: SourcingItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await _get_sourcing_item(db, item_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    old_value = _sourcing_item_snapshot(existing)
    item = await update_item(db, item_id, current_user.id, req.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="sourcing_item",
        resource_id=item.id,
        old_value=old_value,
        new_value=_sourcing_item_snapshot(item),
        detail="更新品源记录",
    )
    return ApiResponse(data=SourcingItemResponse.model_validate(item))


@router.delete("/{item_id}", response_model=ApiResponse)
async def delete_sourcing_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await _get_sourcing_item(db, item_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    old_value = _sourcing_item_snapshot(existing)
    deleted = await delete_item(db, item_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="sourcing_item",
        resource_id=item_id,
        old_value=old_value,
        detail="删除品源记录",
    )
    return ApiResponse(data={"message": "Item deleted"})


@router.get("/filters", response_model=ApiResponse)
async def get_sourcing_filters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get available categories and markets for filtering."""
    from sqlalchemy import select, distinct
    cats = await db.execute(select(distinct(SourcingItem.category)).where(SourcingItem.user_id == current_user.id))
    mkts = await db.execute(select(distinct(SourcingItem.market)).where(SourcingItem.user_id == current_user.id))
    return ApiResponse(data={
        "categories": sorted([c for c in cats.scalars().all() if c]),
        "markets": sorted([m for m in mkts.scalars().all() if m]),
    })


@router.get("/pipeline", response_model=ApiResponse)
async def pipeline_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    summary = await get_pipeline_summary(db, current_user.id)
    return ApiResponse(data=SourcingPipelineSummary(**summary))


@router.get("/stages", response_model=ApiResponse)
async def list_pipeline_stages(db: AsyncSession = Depends(get_db)):
    """Return available pipeline stages."""
    from app.services.dictionary import get_all_dicts
    dictionaries = await get_all_dicts(db)
    stages = [
        {"key": item["id"], "label": item["label"]}
        for item in dictionaries.get("sourcing_pipeline_stages", [])
    ]
    return ApiResponse(data=stages)


# ========== 1688 supplier search ==========

@router.get("/search-1688", response_model=ApiResponse)
async def search_1688(
    product_name: str = Query(..., description="Product name to search on 1688"),
    category: Optional[str] = Query(None, description="Product category"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Build 1688 search URLs for supplier matching. Click to open in browser."""
    results = await search_1688_suppliers(db, product_name, category)
    return ApiResponse(data={
        "suggestions": results,
        "note": "需要在国内网络环境下打开1688链接浏览供应商",
        "domain": "https://www.1688.com/",
    })


# ========== Supplier endpoints ==========

@router.get("/{item_id}/suppliers", response_model=ApiResponse)
async def list_item_suppliers(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    suppliers = await list_suppliers(db, item_id, current_user.id)
    from app.schemas.sourcing import SupplierResponse
    gaps = [] if suppliers else ["当前品源暂无供应商记录"]
    if suppliers and any(item.purchase_price_rmb is None for item in suppliers):
        gaps.append("部分供应商缺少真实采购价")
    return ApiResponse(
        data=[SupplierResponse.model_validate(s) for s in suppliers],
        status="ready" if suppliers else "data_required",
        source_refs=[source_ref("sourcing_supplier", item.id, label=item.supplier_name) for item in suppliers],
        evidence_window="当前品源供应商记录",
        confidence_reason="供应商名称、链接、报价、MOQ 与评级只来自用户采集或录入。",
        data_gaps=gaps,
    )


@router.post("/suppliers", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def add_supplier(
    req: SupplierCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_sourcing_item(db, req.sourcing_item_id, current_user.id)
    if not item:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    s = await create_supplier(db, current_user.id, req.model_dump())
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="sourcing_supplier",
        resource_id=s.id,
        new_value=_supplier_snapshot(s),
        detail="新增品源供应商",
    )
    return ApiResponse(data=SupplierResponse.model_validate(s))


@router.delete("/suppliers/{supplier_id}", response_model=ApiResponse)
async def remove_supplier(
    supplier_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    supplier = await _get_supplier(db, supplier_id, current_user.id)
    if not supplier:
        raise HTTPException(status_code=404)
    old_value = _supplier_snapshot(supplier)
    deleted = await delete_supplier(db, supplier_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404)
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="sourcing_supplier",
        resource_id=supplier_id,
        old_value=old_value,
        detail="删除品源供应商",
    )
    return ApiResponse(data={"message": "Supplier removed"})


# ========== Pipeline stage advancement ==========

class StageAdvanceRequest(BaseModel):
    target_stage: str


@router.put("/{item_id}/stage", response_model=ApiResponse)
async def advance_pipeline_stage(
    item_id: str,
    req: StageAdvanceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Advance sourcing item to next pipeline stage with validation."""
    existing = await _get_sourcing_item(db, item_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    old_value = _sourcing_item_snapshot(existing)
    item, error = await advance_stage(db, item_id, current_user.id, req.target_stage)
    if not item:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    if error:
        raise HTTPException(status_code=400, detail=error)
    await record_audit_event(
        db,
        user=current_user,
        action="stage_change",
        resource_type="sourcing_item",
        resource_id=item.id,
        old_value=old_value,
        new_value=_sourcing_item_snapshot(item),
        detail="推进品源阶段",
    )
    return ApiResponse(data=SourcingItemResponse.model_validate(item))


@router.post("/{item_id}/record-purchase", response_model=ApiResponse)
async def record_purchase_cost(
    item_id: str,
    req: PurchaseLedgerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a sourcing purchase into the finance ledger."""
    result, error = await record_purchase_ledger(db, item_id, current_user.id, req.model_dump())
    if error == "Sourcing item not found":
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    if error:
        raise HTTPException(status_code=400, detail=error)
    await record_audit_event(
        db,
        user=current_user,
        action="record_purchase",
        resource_type="sourcing_item",
        resource_id=item_id,
        new_value={
            "request": req.model_dump(),
            "ledger_entries": result.get("entries", []) if result else [],
            "total_rmb": result.get("total_rmb") if result else None,
        },
        detail="记录品源采购并写入财务台账",
    )
    return ApiResponse(data=result)


# ========== Cost calculation ==========

@router.post("/{item_id}/calculate-cost", response_model=ApiResponse)
async def calculate_sourcing_cost(
    item_id: str,
    req: CostCalculationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate cost and profit for a sourcing item."""
    try:
        result = calculate_cost(req.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Save calculated values to the item
    existing = await _get_sourcing_item(db, item_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    old_value = _sourcing_item_snapshot(existing)
    item = await update_item(db, item_id, current_user.id, {
        "total_cost_rmb": result["total_cost_rmb"],
        "profit_margin_pct": result["profit_margin_pct"],
    })
    await record_audit_event(
        db,
        user=current_user,
        action="calculate_cost",
        resource_type="sourcing_item",
        resource_id=item_id,
        old_value=old_value,
        new_value=_sourcing_item_snapshot(item),
        detail="计算并保存品源成本利润",
    )

    return ApiResponse(data=CostCalculationResponse(**result))


@router.post("/{item_id}/save-cost", response_model=ApiResponse)
async def save_cost_settings(
    item_id: str,
    req: SourcingItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save cost-related fields to a sourcing item."""
    cost_fields = {
        "domestic_shipping_rmb", "intl_shipping_rmb", "packaging_cost_rmb",
        "platform_fee_pct", "payment_fee_pct", "return_reserve_pct",
        "exchange_rate", "total_cost_rmb", "listing_url",
    }
    updates = {k: v for k, v in req.model_dump(exclude_unset=True).items()
               if k in cost_fields}
    if not updates:
        raise HTTPException(status_code=400, detail="No cost fields provided")

    existing = await _get_sourcing_item(db, item_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    item = await update_item(db, item_id, current_user.id, updates)
    if not item:
        raise HTTPException(status_code=404, detail="Sourcing item not found")
    await record_audit_event(
        db,
        user=current_user,
        action="save_cost",
        resource_type="sourcing_item",
        resource_id=item.id,
        old_value=_sourcing_item_snapshot(existing),
        new_value=_sourcing_item_snapshot(item),
        detail="保存品源成本参数",
    )
    return ApiResponse(data=SourcingItemResponse.model_validate(item))




# ══════════════════════════════════════════
# Supplier Scoring
# ══════════════════════════════════════════
from pydantic import BaseModel
from typing import Optional
from app.models.sourcing_supplier import SourcingSupplier

class SupplierScoreRequest(BaseModel):
    quality_score: Optional[int] = None
    delivery_score: Optional[int] = None
    price_score: Optional[int] = None
    communication_score: Optional[int] = None
    certification_score: Optional[int] = None

@router.put("/suppliers/{supplier_id}/score")
async def score_supplier(
    supplier_id: str,
    req: SupplierScoreRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Score a supplier across 5 dimensions."""
    result = await db.execute(select(SourcingSupplier).where(
        SourcingSupplier.id == supplier_id,
        SourcingSupplier.user_id == current_user.id,
    ))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(404, "供应商不存在")
    old_value = _supplier_snapshot(supplier)

    scores = []
    for field in ["quality_score", "delivery_score", "price_score", "communication_score", "certification_score"]:
        val = getattr(req, field)
        if val is not None:
            setattr(supplier, field, max(0, min(100, val)))
            scores.append(val)

    # Auto-calculate overall score
    dims = [supplier.quality_score, supplier.delivery_score, supplier.price_score,
            supplier.communication_score, supplier.certification_score]
    valid = [d for d in dims if d is not None]
    supplier.overall_score = round(sum(valid) / len(valid), 1) if valid else None

    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="score",
        resource_type="sourcing_supplier",
        resource_id=supplier.id,
        old_value=old_value,
        new_value=_supplier_snapshot(supplier),
        detail="更新供应商评分",
    )
    return ApiResponse(data={
        "id": supplier.id,
        "quality_score": supplier.quality_score,
        "delivery_score": supplier.delivery_score,
        "price_score": supplier.price_score,
        "communication_score": supplier.communication_score,
        "certification_score": supplier.certification_score,
        "overall_score": supplier.overall_score,
    })


async def _get_sourcing_item(db: AsyncSession, item_id: str, user_id: str) -> Optional[SourcingItem]:
    result = await db.execute(
        select(SourcingItem).where(
            SourcingItem.id == item_id,
            SourcingItem.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _get_supplier(db: AsyncSession, supplier_id: str, user_id: str) -> Optional[SourcingSupplier]:
    result = await db.execute(
        select(SourcingSupplier).where(
            SourcingSupplier.id == supplier_id,
            SourcingSupplier.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def _sourcing_item_snapshot(item: Optional[SourcingItem]) -> Optional[dict]:
    if not item:
        return None
    return {
        "id": item.id,
        "source_name": item.source_name,
        "source_url": item.source_url,
        "source_price_rmb": item.source_price_rmb,
        "product_name": item.product_name,
        "product_name_cn": item.product_name_cn,
        "weight_g": item.weight_g,
        "category": item.category,
        "platform": item.platform,
        "market": item.market,
        "pipeline_stage": item.pipeline_stage,
        "price_review_status": item.price_review_status,
        "selling_price_local": item.selling_price_local,
        "profit_margin_pct": item.profit_margin_pct,
        "domestic_shipping_rmb": item.domestic_shipping_rmb,
        "intl_shipping_rmb": item.intl_shipping_rmb,
        "packaging_cost_rmb": item.packaging_cost_rmb,
        "platform_fee_pct": item.platform_fee_pct,
        "payment_fee_pct": item.payment_fee_pct,
        "return_reserve_pct": item.return_reserve_pct,
        "exchange_rate": item.exchange_rate,
        "total_cost_rmb": item.total_cost_rmb,
        "listing_url": item.listing_url,
        "tags": item.tags,
        "is_active": item.is_active,
    }


def _supplier_snapshot(supplier: SourcingSupplier) -> dict:
    return {
        "id": supplier.id,
        "sourcing_item_id": supplier.sourcing_item_id,
        "supplier_name": supplier.supplier_name,
        "supplier_url": supplier.supplier_url,
        "purchase_price_rmb": supplier.purchase_price_rmb,
        "shipping_estimate_rmb": supplier.shipping_estimate_rmb,
        "moq": supplier.moq,
        "rating": supplier.rating,
        "is_preferred": supplier.is_preferred,
        "quality_score": supplier.quality_score,
        "delivery_score": supplier.delivery_score,
        "price_score": supplier.price_score,
        "communication_score": supplier.communication_score,
        "certification_score": supplier.certification_score,
        "overall_score": supplier.overall_score,
    }

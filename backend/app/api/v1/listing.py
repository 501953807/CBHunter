"""Batch listing publish API."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import batch_publish_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import evidence_payload, source_ref, unique_refs
from app.services.listing_instance_service import (
    get_product_listing_matrix,
    promote_listing_to_base_version,
    update_listing_overrides,
)

router = APIRouter(prefix="/listing", tags=["listing"])


@router.get("/products/{product_id}/matrix", response_model=ApiResponse)
async def product_listing_matrix(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return Product Master -> base version -> platform/store Listing instance matrix."""
    matrix = await get_product_listing_matrix(db, current_user.id, product_id)
    if not matrix:
        raise HTTPException(status_code=404, detail="商品不存在或无权访问")
    refs = [
        source_ref("product", matrix["product_master"]["id"], label=matrix["product_master"]["name"]),
        *[
            source_ref("platform_listing", item["id"], label=item["title"])
            for item in matrix.get("listing_instances", [])
        ],
    ]
    return ApiResponse(
        data=matrix,
        status="ready",
        **evidence_payload(
            source_refs=refs,
            evidence_window="当前商品主档、基础版本和平台店铺 Listing 实例",
            confidence_reason="矩阵直接读取商品主档和每个 PlatformListing，店铺覆盖字段只归属当前 Listing 实例。",
            data_gaps=[],
        ),
    )


@router.patch("/instances/{listing_id}/overrides", response_model=ApiResponse)
async def patch_listing_overrides(
    listing_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update store-level Listing overrides without changing Product Master or sibling listings."""
    overrides = data.get("overrides") if isinstance(data, dict) else None
    if not isinstance(overrides, dict) or not overrides:
        raise HTTPException(status_code=400, detail="请提供店铺级覆盖字段")
    updated = await update_listing_overrides(db, current_user.id, listing_id, overrides)
    if not updated:
        raise HTTPException(status_code=404, detail="Listing 不存在或无权访问")
    await record_audit_event(
        db,
        user=current_user,
        action="listing_overrides_update",
        resource_type="platform_listing",
        resource_id=listing_id,
        new_value={"overrides": overrides},
        detail="更新店铺级 Listing 覆盖字段",
    )
    return ApiResponse(
        data=updated,
        status="ready",
        **evidence_payload(
            source_refs=[source_ref("platform_listing", listing_id, label=updated.get("title"))],
            evidence_window="当前店铺级 Listing 覆盖字段更新",
            confidence_reason="仅更新当前 PlatformListing 的 listing_overrides，不回写商品主档或其他店铺 Listing。",
            data_gaps=[],
        ),
    )


@router.post("/instances/{listing_id}/promote-base-version", response_model=ApiResponse)
async def post_promote_listing_base_version(
    listing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Explicitly generate a new product base version from one store Listing."""
    result = await promote_listing_to_base_version(db, current_user.id, listing_id)
    if not result:
        raise HTTPException(status_code=404, detail="Listing 不存在或无权访问")
    base = result.get("base_version") or {}
    listing = result.get("listing_instance") or {}
    await record_audit_event(
        db,
        user=current_user,
        action="listing_promote_base_version",
        resource_type="platform_listing",
        resource_id=listing_id,
        new_value={
            "product_id": listing.get("product_id"),
            "base_version": base.get("version"),
            "source_platform": base.get("source_platform"),
            "source_store": base.get("source_store"),
        },
        detail="从店铺级 Listing 显式生成商品基础版本",
    )
    return ApiResponse(
        data=result,
        status="ready",
        **evidence_payload(
            source_refs=[
                source_ref("product", listing.get("product_id"), label=(result.get("product_master") or {}).get("name")),
                source_ref("platform_listing", listing_id, label=listing.get("title")),
            ],
            evidence_window="当前店铺 Listing 显式反哺商品基础版本",
            confidence_reason="只有用户触发生成新基础版本时才更新商品主档基础版本；普通店铺 Listing 编辑仍保持实例隔离。",
            data_gaps=[],
        ),
    )


@router.get("/workbench", response_model=ApiResponse)
async def listing_workbench(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List content-confirmed and price-confirmed products ready for local listing draft work."""
    items = await batch_publish_service.list_publish_ready_items(db, current_user.id)
    refs = unique_refs([
        ref
        for item in items
        for ref in item.get("source_refs", [])
    ])
    status = "ready" if items else "data_required"
    gaps = [] if items else ["listing_ready_items"]
    return ApiResponse(data={
        "status": status,
        "metrics": {"total": len(items)},
        "items": items,
        "data_gaps": gaps,
        "evidence_window": "当前内容已确认且定价已确认的发布就绪商品",
        "confidence_reason": "批量刊登入口只展示内容任务已人工确认、价格已确认且具备平台/市场/售价的商品。",
    }, status=status, **evidence_payload(
        source_refs=refs,
        evidence_window="当前内容已确认且定价已确认的发布就绪商品",
        confidence_reason="批量刊登入口只展示内容任务已人工确认、价格已确认且具备平台/市场/售价的商品。",
        data_gaps=gaps,
    ))


@router.post("/batch-preview", response_model=ApiResponse)
async def batch_preview(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate listing drafts for selected products without publishing."""
    sourcing_item_ids: list[str] = data.get("sourcing_item_ids") or []
    product_ids: list[str] = data.get("product_ids") or []
    platforms: list[str] = data.get("platforms") or []
    markets: list[str] = data.get("markets") or []
    platform_account_ids: list[str] = data.get("platform_account_ids") or []
    pricing_mode: Optional[str] = data.get("pricing_mode")
    target_profit_pct: Optional[float] = data.get("target_profit_pct")

    if not sourcing_item_ids and not product_ids:
        raise HTTPException(status_code=400, detail="请选择至少一个产品")
    if not platforms:
        raise HTTPException(status_code=400, detail="请选择至少一个目标平台")
    if not markets:
        raise HTTPException(status_code=400, detail="请选择至少一个目标市场")
    if not platform_account_ids:
        raise HTTPException(status_code=400, detail="请选择至少一个目标店铺")
    if pricing_mode not in ("cost_based", "selling_based"):
        raise HTTPException(status_code=400, detail="定价策略无效")
    if target_profit_pct is None:
        raise HTTPException(status_code=400, detail="请填写目标利润率")

    drafts = await batch_publish_service.generate_listing_drafts(
        db=db,
        user_id=current_user.id,
        sourcing_item_ids=sourcing_item_ids,
        product_ids=product_ids,
        platforms=platforms,
        markets=markets,
        pricing_mode=pricing_mode,
        target_profit_pct=target_profit_pct,
        platform_account_ids=platform_account_ids,
    )

    # Summary stats
    total_products = len(set(sourcing_item_ids)) + len(set(product_ids))
    total_listings = len(drafts)
    margin_values = [d["estimated_profit_margin"] for d in drafts if d.get("estimated_profit_margin") is not None]
    avg_margin = round(
        sum(margin_values) / max(len(margin_values), 1), 1
    ) if margin_values else None

    refs = unique_refs([
        ref
        for draft in drafts
        for ref in draft.get("source_refs", [])
    ])
    gaps = sorted({gap for draft in drafts for gap in draft.get("data_gaps", [])})
    return ApiResponse(data={
        "drafts": drafts,
        "summary": {
            "total_products": total_products,
            "total_listings": total_listings,
            "platforms": platforms,
            "markets": markets,
            "avg_estimated_margin_pct": avg_margin,
        },
    }, status="ready" if drafts and not gaps else "data_required",
       **evidence_payload(
           source_refs=refs,
           evidence_window="当前批量刊登预览请求",
           confidence_reason="预览基于所选品源、平台市场配置、费率与真实成本生成；有缺口的草稿不可发布。",
           data_gaps=gaps or ([] if drafts else ["未生成可复核的刊登草稿"]),
       ))


@router.post("/drafts/assist", response_model=ApiResponse)
async def listing_draft_assist(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a non-saving AI/rule candidate patch for one Listing draft."""
    result = await batch_publish_service.generate_listing_assist(db, data)
    await record_audit_event(
        db,
        user=current_user,
        action="listing_draft_assist",
        resource_type="listing_draft",
        resource_id=data.get("source_product_id") or data.get("sourcing_item_id") or "draft",
        new_value={
            "assist_type": result.get("assist_type"),
            "provider": result.get("provider"),
            "confidence": result.get("confidence"),
            "status": result.get("status"),
            "does_not_save": True,
        },
        detail="生成 Listing 草稿辅助候选，不自动保存",
    )
    gaps = result.get("data_gaps") or ([] if result.get("status") == "ready" else ["listing_assist_result"])
    return ApiResponse(
        data=result,
        status=result.get("status") or "ready",
        **evidence_payload(
            source_refs=[
                source_ref("product", data.get("source_product_id"), label=data.get("product_name"))
                if data.get("source_product_id")
                else source_ref("sourcing_item", data.get("sourcing_item_id"), label=data.get("product_name"))
            ],
            evidence_window="当前 Listing 草稿输入",
            confidence_reason="Listing 辅助只返回候选 patch，不保存草稿、不发布平台；低置信规则候选必须人工确认。",
            data_gaps=gaps,
        ),
    )


@router.post("/batch-publish", response_model=ApiResponse)
async def batch_publish(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm approved listing drafts and save them as local drafts."""
    drafts: list[dict] = data.get("drafts", [])
    publish_plan: dict = data.get("publish_plan") or {"mode": "immediate"}

    if not drafts:
        raise HTTPException(status_code=400, detail="请选择至少一个要创建草稿的Listing")

    confirmed = [d for d in drafts if d.get("confirmed")]
    if not confirmed:
        raise HTTPException(status_code=400, detail="请确认至少一个Listing")

    results = await batch_publish_service.confirm_publish(
        db=db,
        user_id=current_user.id,
        drafts=confirmed,
        publish_plan=publish_plan,
    )

    drafts_created = sum(1 for item in results if item.get("publish_status") == "draft")
    skipped = sum(1 for item in results if item.get("publish_status") == "skipped")
    await record_audit_event(
        db,
        user=current_user,
        action="listing_batch_draft_create",
        resource_type="platform_listing",
        resource_id="batch",
        new_value={
            "drafts_created": drafts_created,
            "skipped": skipped,
            "draft_count": len(confirmed),
            "publish_plan": publish_plan,
            "listing_ids": [item.get("listing_id") for item in results if item.get("listing_id")],
        },
        detail="批量刊登确认后创建本地 Listing 草稿",
    )

    return ApiResponse(data={
        "published": 0,
        "drafts_created": drafts_created,
        "skipped": skipped,
        "status": "local_draft_created",
        "publish_plan": publish_plan,
        "platform_publish_status": "not_attempted",
        "results": results,
    }, status="ready" if drafts_created else "data_required",
       **evidence_payload(
           source_refs=[source_ref("platform_listing", item.get("listing_id"), label=item.get("product_name"))
                        for item in results if item.get("listing_id")],
           evidence_window="当前批量草稿创建操作",
           confidence_reason="当前能力仅创建本地 Listing 草稿，published 始终为 0，不代表平台刊登成功。",
           data_gaps=[] if drafts_created else ["未创建本地 Listing 草稿"],
       ))

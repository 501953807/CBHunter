"""Promotion campaign API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse, PaginationMeta
from app.services import promotion_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import evidence_payload, source_ref

router = APIRouter(prefix="/promotions", tags=["promotions"])


@router.get("", response_model=ApiResponse)
async def list_promotions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaigns = await promotion_service.list_promotion_campaigns(db, current_user.id)
    return ApiResponse(
        data=campaigns,
        meta=PaginationMeta(
            page=1,
            page_size=len(campaigns),
            total=len(campaigns),
            total_pages=1,
            summary=promotion_service.build_promotion_governance_summary(campaigns),
        ),
        status="ready" if campaigns else "data_required",
        **evidence_payload(
            source_refs=[source_ref("promotion_campaign", item["id"], label=item["name"]) for item in campaigns],
            evidence_window="当前用户促销活动",
            confidence_reason="促销活动独立于 Listing 保存，一个活动可包含多个参与商品。",
            data_gaps=[] if campaigns else ["promotion_campaigns"],
        ),
    )


@router.post("", response_model=ApiResponse, status_code=201)
async def create_promotion(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        campaign = await promotion_service.create_promotion_campaign(db, current_user.id, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=current_user,
        action="create_promotion_campaign",
        resource_type="promotion_campaign",
        resource_id=campaign["id"],
        new_value=campaign,
        detail="创建独立促销活动",
    )
    return ApiResponse(
        data=campaign,
        status="ready",
        **evidence_payload(
            source_refs=[source_ref("promotion_campaign", campaign["id"], label=campaign["name"])],
            evidence_window="促销活动创建",
            confidence_reason="促销活动按平台店铺独立创建，参与商品通过活动明细绑定。",
            data_gaps=[],
        ),
    )


@router.patch("/{campaign_id}", response_model=ApiResponse)
async def update_promotion(
    campaign_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        campaign = await promotion_service.update_promotion_campaign(db, current_user.id, campaign_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=current_user,
        action="update_promotion_campaign",
        resource_type="promotion_campaign",
        resource_id=campaign["id"],
        new_value={key: campaign.get(key) for key in ("name", "promotion_type", "status", "starts_at", "ends_at", "stack_rule")},
        detail="修改促销活动基础信息",
    )
    return ApiResponse(
        data=campaign,
        status="ready",
        **evidence_payload(
            source_refs=[source_ref("promotion_campaign", campaign["id"], label=campaign["name"])],
            evidence_window="促销活动基础信息修改",
            confidence_reason="当前只更新独立促销活动基础信息，不修改参与商品、商品主档或 Listing 覆盖字段。",
            data_gaps=["promotion_platform_sync"] if campaign["source"] == "local" else [],
        ),
    )


@router.patch("/{campaign_id}/state", response_model=ApiResponse)
async def update_promotion_state(
    campaign_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        campaign = await promotion_service.update_promotion_campaign_status(db, current_user.id, campaign_id, str(data.get("status") or ""))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=current_user,
        action="update_promotion_campaign_state",
        resource_type="promotion_campaign",
        resource_id=campaign["id"],
        new_value={"status": campaign["status"]},
        detail="更新本地促销活动状态",
    )
    return ApiResponse(
        data=campaign,
        status="ready",
        **evidence_payload(
            source_refs=[source_ref("promotion_campaign", campaign["id"], label=campaign["name"])],
            evidence_window="促销活动状态更新",
            confidence_reason="当前只更新本地促销活动状态；平台活动同步需等待 Open API 接通。",
            data_gaps=["promotion_platform_sync"] if campaign["source"] == "local" else [],
        ),
    )


@router.post("/{campaign_id}/items", response_model=ApiResponse)
async def add_promotion_items(
    campaign_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        campaign = await promotion_service.add_promotion_campaign_items(db, current_user.id, campaign_id, data.get("items") or [])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=current_user,
        action="add_promotion_campaign_items",
        resource_type="promotion_campaign",
        resource_id=campaign["id"],
        new_value={"product_count": campaign["product_count"]},
        detail="追加促销活动参与商品",
    )
    return ApiResponse(
        data=campaign,
        status="ready",
        **evidence_payload(
            source_refs=[source_ref("promotion_campaign", campaign["id"], label=campaign["name"])],
            evidence_window="促销活动参与商品追加",
            confidence_reason="参与商品追加到独立促销活动明细，不写入商品主档或 Listing 覆盖字段。",
            data_gaps=["promotion_platform_sync"] if campaign["source"] == "local" else [],
        ),
    )


@router.patch("/{campaign_id}/discount", response_model=ApiResponse)
async def update_promotion_discount(
    campaign_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        campaign = await promotion_service.update_promotion_campaign_items_discount(db, current_user.id, campaign_id, float(data.get("discount_value") or 0))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=current_user,
        action="update_promotion_campaign_discount",
        resource_type="promotion_campaign",
        resource_id=campaign["id"],
        new_value={"discount_value": data.get("discount_value")},
        detail="修改促销活动折扣",
    )
    return ApiResponse(
        data=campaign,
        status="ready",
        **evidence_payload(
            source_refs=[source_ref("promotion_campaign", campaign["id"], label=campaign["name"])],
            evidence_window="促销活动折扣修改",
            confidence_reason="折扣修改只更新促销活动明细，不写入商品主档或 Listing 覆盖字段。",
            data_gaps=["promotion_platform_sync"] if campaign["source"] == "local" else [],
        ),
    )


@router.post("/{campaign_id}/sync", response_model=ApiResponse)
async def sync_promotion(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await promotion_service.sync_promotion_campaign(db, current_user.id, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    campaign = result["campaign"]
    await record_audit_event(
        db,
        user=current_user,
        action="sync_promotion_campaign",
        resource_type="promotion_campaign",
        resource_id=campaign["id"],
        new_value={"status": result["status"], "data_gaps": result["data_gaps"]},
        detail="尝试同步促销活动到平台",
    )
    return ApiResponse(
        data=campaign,
        status=result["status"],
        **evidence_payload(
            source_refs=[source_ref("promotion_campaign", campaign["id"], label=campaign["name"])],
            evidence_window=result["evidence_window"],
            confidence_reason=result["confidence_reason"],
            data_gaps=result["data_gaps"],
        ),
    )

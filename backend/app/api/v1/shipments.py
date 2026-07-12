import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.shipment import (
    ShipmentCreate, ShipmentUpdate, ShipmentResponse, BatchShipmentCreate,
)
from app.schemas.common import ApiResponse
from app.services.shipment_service import (
    list_shipments, get_shipment, create_shipment, update_shipment,
    batch_create_shipments,
)
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import configuration_required, source_ref

router = APIRouter(prefix="/shipments", tags=["shipments"])


@router.get("", response_model=ApiResponse)
async def list_shipments_endpoint(
    status: Optional[str] = Query(None),
    carrier: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shipments, total = await list_shipments(
        db, current_user.id, status, carrier, page, page_size
    )
    gaps = [] if total else ["当前筛选范围没有物流记录"]
    return ApiResponse(
        data=[ShipmentResponse.model_validate(s) for s in shipments],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size) if total > 0 else 0,
        },
        status="ready" if total else "data_required",
        source_refs=[source_ref("shipment", item.id, label=item.tracking_number or item.id) for item in shipments],
        evidence_window="当前物流单与追踪快照",
        confidence_reason="物流列表只读取当前用户可访问店铺订单关联的真实物流单。",
        data_gaps=gaps,
    )


@router.post("", response_model=ApiResponse)
async def create_shipment_endpoint(
    req: ShipmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _validate_shipping_config(db, req.carrier, req.shipping_method)
    shipment = await create_shipment(db, current_user.id, req)
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="shipment",
        resource_id=shipment.id,
        new_value=_shipment_snapshot(shipment),
        detail="创建物流单",
    )
    gaps = []
    if not shipment.tracking_number:
        gaps.append("物流单缺少运单号")
    if not shipment.tracking_events:
        gaps.append("承运商轨迹尚未接入或尚无轨迹")
    if shipment.shipping_cost is None:
        gaps.append("物流单缺少实际运费")
    return ApiResponse(
        data=ShipmentResponse.model_validate(shipment),
        status="ready",
        source_refs=[
            source_ref("shipment", shipment.id, label=shipment.tracking_number or shipment.id),
            source_ref("order", shipment.order_id, label="关联订单"),
        ],
        evidence_window="物流单当前快照",
        confidence_reason="物流详情来自本地物流单及已接入的真实承运商轨迹；未接入轨迹时保持缺口。",
        data_gaps=gaps,
    )


@router.post("/batch", response_model=ApiResponse)
async def batch_create(
    req: BatchShipmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _validate_shipping_config(db, req.carrier, req.shipping_method)
    shipments = await batch_create_shipments(db, current_user.id, req.order_ids, req.carrier, req.shipping_method)
    await record_audit_event(
        db,
        user=current_user,
        action="batch_create",
        resource_type="shipment",
        resource_id=",".join([item.id for item in shipments]),
        new_value={
            "shipment_ids": [item.id for item in shipments],
            "order_ids": req.order_ids,
            "carrier": req.carrier,
            "shipping_method": req.shipping_method,
        },
        detail="批量创建物流单",
    )
    return ApiResponse(data=[ShipmentResponse.model_validate(s) for s in shipments])


@router.get("/{shipment_id}", response_model=ApiResponse)
async def get_shipment_endpoint(
    shipment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shipment = await get_shipment(db, current_user.id, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return ApiResponse(data=ShipmentResponse.model_validate(shipment))


@router.put("/{shipment_id}", response_model=ApiResponse)
async def update_shipment_endpoint(
    shipment_id: str,
    req: ShipmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shipment = await get_shipment(db, current_user.id, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if req.carrier is not None or req.shipping_method is not None:
        await _validate_shipping_config(
            db,
            req.carrier if req.carrier is not None else shipment.carrier,
            req.shipping_method if req.shipping_method is not None else shipment.shipping_method,
        )
    old_value = _shipment_snapshot(shipment)
    updated = await update_shipment(db, current_user.id, shipment, req)
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="shipment",
        resource_id=updated.id,
        old_value=old_value,
        new_value=_shipment_snapshot(updated),
        detail="更新物流单",
    )
    return ApiResponse(data=ShipmentResponse.model_validate(updated))


async def _validate_shipping_config(
    db: AsyncSession,
    carrier: str,
    shipping_method: Optional[str] = None,
) -> None:
    config = await config_service.get_all_config(db)
    carriers = config.get("carriers", [])
    methods = config.get("shipping_methods", [])
    if not carriers:
        raise HTTPException(
            status_code=409,
            detail=configuration_required(
                "请先在设置中心配置物流承运商",
                data_gaps=["dict.carriers"],
                evidence_window="当前系统字典配置",
            ),
        )
    carrier_values = {item.get("id") for item in carriers} | {item.get("label") for item in carriers}
    if carrier not in carrier_values:
        raise HTTPException(status_code=400, detail="承运商未在设置中心字典中配置")
    if shipping_method:
        if not methods:
            raise HTTPException(
                status_code=409,
                detail=configuration_required(
                    "请先在设置中心配置运输方式",
                    data_gaps=["dict.shipping_methods"],
                    evidence_window="当前系统字典配置",
                ),
            )
        method_values = {item.get("id") for item in methods} | {item.get("label") for item in methods}
        if shipping_method not in method_values:
            raise HTTPException(status_code=400, detail="运输方式未在设置中心字典中配置")


def _shipment_snapshot(shipment) -> dict:
    return {
        "id": shipment.id,
        "order_id": shipment.order_id,
        "platform_account_id": shipment.platform_account_id,
        "tracking_number": shipment.tracking_number,
        "carrier": shipment.carrier,
        "shipping_method": shipment.shipping_method,
        "status": shipment.status,
        "actual_weight_g": shipment.actual_weight_g,
        "volumetric_weight_g": shipment.volumetric_weight_g,
        "shipping_cost": shipment.shipping_cost,
        "origin_address": shipment.origin_address,
        "destination_address": shipment.destination_address,
        "estimated_delivery_date": shipment.estimated_delivery_date,
        "actual_delivery_date": shipment.actual_delivery_date,
    }

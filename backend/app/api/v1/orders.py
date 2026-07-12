import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.order import (
    OrderListResponse, OrderDetailResponse, OrderItemResponse,
    ManualOrderCreate, OrderStatusUpdate, OrderNoteUpdate,
)
from app.schemas.common import ApiResponse
from app.services.order_service import (
    build_fulfillment_exception_context, build_order_fee_context, build_order_list_context, create_manual_order, get_order_sync_reviews, list_orders, get_order, update_order_status, update_order_notes, get_order_stats
)
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=ApiResponse)
async def list_orders_endpoint(
    status: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    platform_account_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    orders, total = await list_orders(
        db, current_user.id, status, platform, platform_account_id, search,
        date_from, date_to, page, page_size
    )

    data = []
    sync_reviews = await get_order_sync_reviews(db, orders)
    for o in orders:
        d = OrderListResponse.model_validate(o)
        d.platform = o.platform_account.platform if hasattr(o, 'platform_account') and o.platform_account else ""
        d.source = (o.platform_data or {}).get("source", "platform")
        for key, value in build_order_list_context(o).items():
            setattr(d, key, value)
        d.platform_sync_status = sync_reviews.get(o.id, {})
        data.append(d)

    gaps = [] if total else ["当前筛选范围没有可访问店铺的订单"]
    if platform_account_id and not total:
        gaps = ["当前店铺没有订单，或该店铺不在当前用户授权范围内"]
    return ApiResponse(
        data=data,
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size) if total > 0 else 0,
        },
        status="ready" if total else "data_required",
        source_refs=[source_ref("order", item.id, label=item.order_number or item.platform_order_id) for item in orders],
        evidence_window=_order_evidence_window(date_from, date_to),
        confidence_reason="订单列表仅查询当前用户可访问店铺中的平台同步、导入或已审计手工订单，并应用当前筛选条件。",
        data_gaps=gaps,
    )


@router.post("/manual", response_model=ApiResponse, status_code=201)
async def create_manual_order_endpoint(
    req: ManualOrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        order = await create_manual_order(db, current_user.id, req)
    except ValueError as exc:
        messages = {
            "platform_account_not_accessible": "请选择当前用户可访问的启用店铺",
            "platform_not_supported": "手工订单仅支持 Shopee、TEMU、TikTok Shop",
            "manual_order_disabled_for_connected_store": "该店铺已具备真实订单同步能力，请使用平台同步",
            "manual_order_number_exists": "该店铺已存在相同手工订单号",
        }
        raise HTTPException(status_code=400, detail=messages.get(str(exc), str(exc))) from exc

    await record_audit_event(
        db,
        user=current_user,
        action="manual_order_create",
        resource_type="order",
        resource_id=order.id,
        new_value={
            "order_number": order.order_number,
            "platform_account_id": order.platform_account_id,
            "total": order.total,
            "currency": order.currency,
            "source": "manual",
            "item_count": len(order.items or []),
        },
        detail="平台 API 未接入期间手工创建订单",
    )
    response = OrderDetailResponse.model_validate(order)
    response.platform = order.platform_account.platform if order.platform_account else ""
    response.source = "manual"
    response.items = [OrderItemResponse.model_validate(item) for item in order.items or []]
    for key, value in build_order_fee_context(order).items():
        setattr(response, key, value)
    response.fulfillment_exception = build_fulfillment_exception_context(order)
    response.platform_sync_review = (await get_order_sync_reviews(db, [order])).get(order.id, {})
    return ApiResponse(
        data=response,
        status="ready",
        source_refs=[source_ref("order", order.id, label=f"手工订单 {order.order_number}", meta={"source": "manual"})],
        evidence_window="手工录入时点",
        confidence_reason="订单由当前用户手工录入并绑定已配置店铺，不代表平台 API 已同步。",
        data_gaps=["该订单未经过平台 API 对账"],
    )


@router.get("/stats", response_model=ApiResponse)
async def order_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await get_order_stats(db, current_user.id)
    total = sum(stats.values())
    return ApiResponse(
        data=stats,
        status="ready" if total else "data_required",
        source_refs=[source_ref("order", field="status", label="授权店铺订单状态聚合")] if total else [],
        evidence_window="当前全部可访问店铺订单",
        confidence_reason="状态数量直接按当前用户可访问店铺订单聚合。",
        data_gaps=[] if total else ["当前没有可用于状态统计的订单"],
    )


@router.get("/{order_id}", response_model=ApiResponse)
async def get_order_endpoint(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    resp = OrderDetailResponse.model_validate(order)
    resp.platform = order.platform_account.platform if order.platform_account else ""
    resp.source = (order.platform_data or {}).get("source", "platform")
    resp.items = [OrderItemResponse.model_validate(i) for i in (order.items or [])]
    fee_context = build_order_fee_context(order)
    for key, value in fee_context.items():
        setattr(resp, key, value)
    resp.fulfillment_exception = build_fulfillment_exception_context(order)
    resp.platform_sync_review = (await get_order_sync_reviews(db, [order])).get(order.id, {})
    gaps = []
    if not resp.items:
        gaps.append("订单缺少商品明细")
    if resp.shipping_address is None:
        gaps.append("订单缺少收货地址")
    for field in ("subtotal", "shipping_fee", "platform_fee", "discount"):
        if getattr(resp, field) is None:
            gaps.append(f"订单缺少{field}字段")
    gaps.extend(fee_context["fee_breakdown"].get("data_gaps") or [])
    refs = [source_ref("order", order.id, label=order.order_number or order.platform_order_id)]
    refs.extend(source_ref("order_item", item.id, label=item.name) for item in (order.items or []))
    return ApiResponse(
        data=resp,
        status="ready",
        source_refs=refs,
        evidence_window="订单当前同步快照",
        confidence_reason="订单详情直接读取平台同步、导入或已审计手工记录；缺失费用和地址保持未知，不按零值补齐。",
        data_gaps=gaps,
    )


@router.put("/{order_id}/status", response_model=ApiResponse)
async def update_status(
    order_id: str,
    req: OrderStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    old_status = order.status
    updated = await update_order_status(db, order, req)
    await record_audit_event(
        db,
        user=current_user,
        action="order_status_update",
        resource_type="order",
        resource_id=order_id,
        old_value={"status": old_status},
        new_value={"status": updated.status},
        detail="更新订单状态",
    )
    return ApiResponse(data=OrderDetailResponse.model_validate(updated))


@router.post("/{order_id}/notes", response_model=ApiResponse)
async def update_notes(
    order_id: str,
    req: OrderNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    old_notes = order.notes
    updated = await update_order_notes(db, order, req)
    await record_audit_event(
        db,
        user=current_user,
        action="order_notes_update",
        resource_type="order",
        resource_id=order_id,
        old_value={"notes": old_notes},
        new_value={"notes": updated.notes},
        detail="更新订单备注",
    )
    return ApiResponse(data={"notes": updated.notes})


def _order_evidence_window(date_from: Optional[str], date_to: Optional[str]) -> str:
    if date_from or date_to:
        return f"下单时间 {date_from or '最早记录'} 至 {date_to or '当前'}"
    return "当前全部订单记录"

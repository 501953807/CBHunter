from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.shipment import Shipment
from app.models.order import Order
from app.models.platform_account import PlatformAccount
from app.models.finance_ledger import FinanceLedgerEntry
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate
from app.services.order_service import build_fulfillment_exception_context
from app.services.store_access_service import list_accessible_store_ids_for_user_id


async def list_shipments(
    db: AsyncSession,
    user_id: str,
    status: Optional[str] = None,
    carrier: Optional[str] = None,
    platform: Optional[str] = None,
    platform_account_id: Optional[str] = None,
    order_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    if not store_ids:
        return [], 0
    if platform_account_id:
        if platform_account_id not in store_ids:
            return [], 0
        store_ids = [platform_account_id]
    query = select(Shipment).join(Order, Shipment.order_id == Order.id).where(Order.platform_account_id.in_(store_ids))

    if status:
        query = query.where(Shipment.status == status)
    if carrier:
        query = query.where(Shipment.carrier == carrier)
    if order_id:
        query = query.where(Shipment.order_id == order_id)
    if platform:
        query = query.join(PlatformAccount, Shipment.platform_account_id == PlatformAccount.id)
        query = query.where(PlatformAccount.platform == platform)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Shipment.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    shipments = list(result.scalars().all())
    return shipments, total


async def get_shipment(db: AsyncSession, user_id: str, shipment_id: str) -> Optional[Shipment]:
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    if not store_ids:
        return None
    result = await db.execute(
        select(Shipment).join(Order, Shipment.order_id == Order.id).where(
            Shipment.id == shipment_id,
            Order.platform_account_id.in_(store_ids),
        )
    )
    return result.scalar_one_or_none()


async def get_shipment_order_contexts(
    db: AsyncSession,
    user_id: str,
    shipments: list[Shipment],
) -> dict[str, dict]:
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    if not store_ids or not shipments:
        return {}
    order_ids = list({shipment.order_id for shipment in shipments if shipment.order_id})
    if not order_ids:
        return {}
    result = await db.execute(
        select(Order).where(
            Order.id.in_(order_ids),
            Order.platform_account_id.in_(store_ids),
        )
    )
    orders = {order.id: order for order in result.scalars().all()}
    return {
        shipment.id: build_shipment_order_context(orders.get(shipment.order_id))
        for shipment in shipments
        if shipment.id and shipment.order_id in orders
    }


def build_shipment_order_context(order: Order | None) -> dict:
    if not order:
        return {}
    platform_data = order.platform_data if isinstance(order.platform_data, dict) else {}
    account = order.platform_account
    return {
        "platform_account_id": order.platform_account_id,
        "platform": account.platform if account else "",
        "platform_account_name": account.account_name if account else None,
        "order_number": order.order_number or order.platform_order_id,
        "order_status": order.status,
        "buyer_name": order.buyer_name,
        "fulfillment_deadline_at": platform_data.get("fulfillment_deadline_at"),
        "fulfillment_exception": build_fulfillment_exception_context(order),
    }


async def create_shipment(db: AsyncSession, user_id: str, req: ShipmentCreate) -> Shipment:
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    order = await db.get(Order, req.order_id)
    if not order or order.platform_account_id not in store_ids:
        raise HTTPException(status_code=404, detail="Order not found")
    shipment = Shipment(
        **req.model_dump(),
        user_id=user_id,
        platform_account_id=order.platform_account_id,
    )
    db.add(shipment)
    await db.flush()
    _sync_order_local_shipment_context(order, shipment)
    await _sync_shipping_cost_ledger(db, user_id, shipment, order)
    await db.commit()
    await db.refresh(shipment)
    return shipment


async def update_shipment(db: AsyncSession, user_id: str, shipment: Shipment, req: ShipmentUpdate) -> Shipment:
    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(shipment, field, value)
    if update_data:
        order = await db.get(Order, shipment.order_id)
        store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
        if order and order.platform_account_id in store_ids:
            _sync_order_local_shipment_context(order, shipment)
            if "shipping_cost" in update_data:
                await _sync_shipping_cost_ledger(db, user_id, shipment, order)
    await db.commit()
    await db.refresh(shipment)
    return shipment


async def batch_create_shipments(db: AsyncSession, user_id: str, order_ids: list[str], carrier: str, shipping_method: Optional[str] = None) -> list[Shipment]:
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    result = await db.execute(
        select(Order).where(Order.id.in_(order_ids), Order.platform_account_id.in_(store_ids))
    )
    orders = list(result.scalars().all())
    order_by_id = {o.id: o for o in orders}
    valid_order_ids = set(order_by_id)
    invalid = set(order_ids) - valid_order_ids
    if invalid:
        raise HTTPException(status_code=404, detail=f"Orders not found: {', '.join(invalid)}")

    shipments = []
    for oid in order_ids:
        s = Shipment(
            user_id=user_id,
            order_id=oid,
            platform_account_id=order_by_id[oid].platform_account_id,
            carrier=carrier,
            shipping_method=shipping_method,
            status="draft",
        )
        db.add(s)
        shipments.append(s)
    await db.flush()
    for shipment in shipments:
        _sync_order_local_shipment_context(order_by_id[shipment.order_id], shipment)
    await db.commit()
    for s in shipments:
        await db.refresh(s)
    return shipments


async def _sync_shipping_cost_ledger(
    db: AsyncSession,
    user_id: str,
    shipment: Shipment,
    order: Order,
) -> None:
    """Create or update one finance ledger entry for a shipment's real freight cost."""
    if shipment.shipping_cost is None:
        return

    result = await db.execute(
        select(FinanceLedgerEntry).where(
            FinanceLedgerEntry.user_id == user_id,
            FinanceLedgerEntry.order_id == order.id,
            FinanceLedgerEntry.entry_type == "shipping_cost",
        )
    )
    existing = None
    for entry in result.scalars().all():
        if (entry.extra or {}).get("shipment_id") == shipment.id:
            existing = entry
            break

    data = {
        "shipment_id": shipment.id,
        "carrier": shipment.carrier,
        "tracking_number": shipment.tracking_number,
    }
    if existing:
        existing.amount_rmb = float(shipment.shipping_cost)
        existing.amount_original = float(shipment.shipping_cost)
        existing.currency = "CNY"
        existing.platform = getattr(order.platform_account, "platform", None)
        existing.market = getattr(order.platform_account, "market", None)
        existing.description = f"物流运费: {shipment.carrier or '未填写承运商'}"
        existing.extra = data
        return

    db.add(FinanceLedgerEntry(
        user_id=user_id,
        entry_type="shipping_cost",
        amount_rmb=float(shipment.shipping_cost),
        amount_original=float(shipment.shipping_cost),
        currency="CNY",
        platform=getattr(order.platform_account, "platform", None),
        market=getattr(order.platform_account, "market", None),
        order_id=order.id,
        description=f"物流运费: {shipment.carrier or '未填写承运商'}",
        extra=data,
    ))


def _sync_order_local_shipment_context(order: Order, shipment: Shipment) -> None:
    """Mirror the real local shipment record into order fulfillment context."""
    platform_data = dict(order.platform_data or {})
    channel = shipment.carrier or shipment.shipping_method
    local_context = {
        "shipment_id": shipment.id,
        "carrier": shipment.carrier,
        "shipping_method": shipment.shipping_method,
        "tracking_number": shipment.tracking_number,
        "shipment_status": shipment.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "local_shipment",
    }
    platform_data["local_shipment_context"] = local_context
    if channel:
        platform_data["logistics_channel"] = channel
        platform_data["logistics_channel_source"] = "local_shipment"
    if shipment.tracking_number:
        platform_data["tracking_number"] = shipment.tracking_number
        platform_data["tracking_number_source"] = "local_shipment"
    if shipment.status in {"shipped", "in_transit", "out_for_delivery", "delivered", "completed"}:
        order.fulfillment_status = shipment.status
        _advance_order_status_from_shipment(order, shipment.status)
    order.platform_data = platform_data


def _advance_order_status_from_shipment(order: Order, shipment_status: str) -> None:
    """Advance non-terminal order status from a real local shipment without overriding platform terminal states."""
    terminal_statuses = {"completed", "cancelled", "refunded", "closed"}
    if order.status in terminal_statuses:
        return
    if shipment_status in {"shipped", "in_transit", "out_for_delivery"} and order.status in {"pending", "processing", "ready_to_ship", "paid", "purchasing"}:
        order.status = "shipped"
    elif shipment_status == "delivered" and order.status in {"pending", "processing", "ready_to_ship", "paid", "purchasing", "shipped", "in_transit"}:
        order.status = "delivered"
    elif shipment_status == "completed" and order.status in {"pending", "processing", "ready_to_ship", "paid", "purchasing", "shipped", "in_transit", "delivered"}:
        order.status = "completed"

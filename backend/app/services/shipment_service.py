from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.shipment import Shipment
from app.models.order import Order
from app.models.finance_ledger import FinanceLedgerEntry
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate
from app.services.store_access_service import list_accessible_store_ids_for_user_id


async def list_shipments(
    db: AsyncSession,
    user_id: str,
    status: Optional[str] = None,
    carrier: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    if not store_ids:
        return [], 0
    query = select(Shipment).join(Order, Shipment.order_id == Order.id).where(Order.platform_account_id.in_(store_ids))

    if status:
        query = query.where(Shipment.status == status)
    if carrier:
        query = query.where(Shipment.carrier == carrier)

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
    await _sync_shipping_cost_ledger(db, user_id, shipment, order)
    await db.commit()
    await db.refresh(shipment)
    return shipment


async def update_shipment(db: AsyncSession, user_id: str, shipment: Shipment, req: ShipmentUpdate) -> Shipment:
    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(shipment, field, value)
    if "shipping_cost" in update_data:
        order = await db.get(Order, shipment.order_id)
        store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
        if order and order.platform_account_id in store_ids:
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

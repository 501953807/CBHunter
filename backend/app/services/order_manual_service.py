"""Manual order creation and batch import service."""

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.status import PLATFORM_CONNECTORS, get_platform_connector_status
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.platform_account import PlatformAccount
from app.schemas.order import ManualOrderCreate
from app.services.store_access_service import list_accessible_store_ids_for_user_id


async def create_manual_order(
    db: AsyncSession,
    user_id: str,
    request: ManualOrderCreate,
) -> Order:
    account = await _get_accessible_manual_account(db, user_id, request.platform_account_id)
    manual_id = _manual_order_id(request.merchant_order_number)
    duplicate = await db.scalar(select(func.count(Order.id)).where(
        Order.platform_account_id == account.id,
        Order.platform_order_id == manual_id,
    ))
    if duplicate:
        raise ValueError("manual_order_number_exists")

    order = _build_manual_order(user_id, account, request, source="manual")
    db.add(order)
    await db.flush()
    db.add_all(_build_manual_items(order.id, request, source="manual"))
    await db.commit()
    return await _get_order_with_items(db, order.id)


async def import_manual_orders(
    db: AsyncSession,
    user_id: str,
    rows: list[ManualOrderCreate],
    import_ref: Optional[str] = None,
    source_file: Optional[str] = None,
) -> dict:
    summary = {
        "import_ref": import_ref,
        "source_file": source_file,
        "received_count": len(rows),
        "created_count": 0,
        "skipped_count": 0,
        "failed_count": 0,
        "created_order_ids": [],
        "skipped": [],
        "failed": [],
    }
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    accounts = await _load_accessible_accounts(db, store_ids)
    accessible_accounts = {account.id: account for account in accounts}
    candidate_ids_by_account: dict[str, set[str]] = {}
    for row in rows:
        candidate_ids_by_account.setdefault(row.platform_account_id, set()).add(
            _manual_order_id(row.merchant_order_number)
        )
    existing_manual_ids = await _load_existing_manual_ids(db, candidate_ids_by_account)
    batch_seen: set[tuple[str, str]] = set()

    for index, row in enumerate(rows, start=1):
        account = accessible_accounts.get(row.platform_account_id)
        manual_id = _manual_order_id(row.merchant_order_number)
        key = (row.platform_account_id, manual_id)
        if not account:
            _record_import_failure(summary, index, row, "platform_account_not_accessible")
            continue
        if account.platform not in PLATFORM_CONNECTORS:
            _record_import_failure(summary, index, row, "platform_not_supported")
            continue
        if get_platform_connector_status(account)["sync_ready"]:
            _record_import_failure(summary, index, row, "manual_order_disabled_for_connected_store")
            continue
        if key in existing_manual_ids or key in batch_seen:
            summary["skipped_count"] += 1
            summary["skipped"].append({
                "row": index,
                "merchant_order_number": row.merchant_order_number,
                "reason": "manual_order_number_exists",
            })
            continue

        order = _build_manual_order(
            user_id,
            account,
            row,
            source="manual_import",
            import_ref=import_ref,
            source_file=source_file,
            import_row=index,
        )
        db.add(order)
        await db.flush()
        db.add_all(_build_manual_items(
            order.id,
            row,
            source="manual_import",
            import_ref=import_ref,
            source_file=source_file,
        ))
        batch_seen.add(key)
        summary["created_count"] += 1
        summary["created_order_ids"].append(order.id)

    if summary["created_count"]:
        await db.commit()
    return summary


async def _get_accessible_manual_account(db: AsyncSession, user_id: str, platform_account_id: str) -> PlatformAccount:
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    account = (await db.execute(select(PlatformAccount).where(
        PlatformAccount.id == platform_account_id,
        PlatformAccount.id.in_(store_ids),
        PlatformAccount.is_active.is_(True),
    ))).scalar_one_or_none()
    if not account:
        raise ValueError("platform_account_not_accessible")
    if account.platform not in PLATFORM_CONNECTORS:
        raise ValueError("platform_not_supported")
    if get_platform_connector_status(account)["sync_ready"]:
        raise ValueError("manual_order_disabled_for_connected_store")
    return account


async def _load_accessible_accounts(db: AsyncSession, store_ids: list[str]) -> list[PlatformAccount]:
    if not store_ids:
        return []
    result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.id.in_(store_ids),
            PlatformAccount.is_active.is_(True),
        )
    )
    return list(result.scalars().all())


async def _load_existing_manual_ids(db: AsyncSession, candidates: dict[str, set[str]]) -> set[tuple[str, str]]:
    if not candidates:
        return set()
    account_ids = list(candidates)
    manual_ids = sorted({manual_id for ids in candidates.values() for manual_id in ids})
    result = await db.execute(
        select(Order.platform_account_id, Order.platform_order_id).where(
            Order.platform_account_id.in_(account_ids),
            Order.platform_order_id.in_(manual_ids),
        )
    )
    return {(account_id, manual_id) for account_id, manual_id in result.all()}


def _build_manual_order(
    user_id: str,
    account: PlatformAccount,
    request: ManualOrderCreate,
    *,
    source: str,
    import_ref: Optional[str] = None,
    source_file: Optional[str] = None,
    import_row: Optional[int] = None,
) -> Order:
    item_subtotal = round(sum(item.quantity * item.unit_price for item in request.items), 2)
    platform_data = {
        "source": source,
        "source_label": "批量导入" if source == "manual_import" else "手工录入",
        "connector_status": get_platform_connector_status(account)["connection_status"],
        "fulfillment_deadline_at": request.fulfillment_deadline_at.isoformat() if request.fulfillment_deadline_at else None,
        "logistics_channel": request.logistics_channel,
    }
    if source == "manual_import":
        platform_data.update({"import_ref": import_ref, "source_file": source_file, "import_row": import_row})
    return Order(
        user_id=user_id,
        platform_account_id=account.id,
        platform_order_id=_manual_order_id(request.merchant_order_number),
        order_number=request.merchant_order_number.strip(),
        status=request.status,
        buyer_name=request.buyer_name,
        shipping_address=request.shipping_address,
        subtotal=item_subtotal,
        shipping_fee=request.shipping_fee,
        platform_fee=request.platform_fee,
        discount=request.discount,
        total=request.total,
        currency=request.currency.upper(),
        payment_status=request.payment_status,
        payment_method=request.payment_method,
        fulfillment_status=request.fulfillment_status,
        notes=request.notes,
        ordered_at=request.ordered_at,
        platform_data=platform_data,
    )


def _build_manual_items(
    order_id: str,
    request: ManualOrderCreate,
    *,
    source: str,
    import_ref: Optional[str] = None,
    source_file: Optional[str] = None,
) -> list[OrderItem]:
    platform_data = {"source": source}
    if source == "manual_import":
        platform_data.update({"import_ref": import_ref, "source_file": source_file})
    return [
        OrderItem(
            order_id=order_id,
            name=item.name.strip(),
            sku=item.sku.strip() if item.sku else None,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=round(item.quantity * item.unit_price, 2),
            platform_data=platform_data,
        )
        for item in request.items
    ]


async def _get_order_with_items(db: AsyncSession, order_id: str) -> Order:
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    return result.scalar_one()


def _manual_order_id(value: str) -> str:
    return f"manual:{value.strip()}"


def _record_import_failure(summary: dict, index: int, row: ManualOrderCreate, reason: str) -> None:
    summary["failed_count"] += 1
    summary["failed"].append({
        "row": index,
        "merchant_order_number": row.merchant_order_number,
        "reason": reason,
    })

"""Actions created from inventory risk workbench objects."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operation_record import OperationRecord
from app.services.inventory_alert_service import get_inventory_risk_workbench
from app.services.operation_service import create_record


async def create_operation_record_from_inventory_slow_moving(
    db: AsyncSession,
    user_id: str,
    listing_id: str,
) -> OperationRecord:
    workbench = await get_inventory_risk_workbench(db, user_id)
    item = next(
        (row for row in workbench["slow_moving"]["items"] if row["listing_id"] == listing_id),
        None,
    )
    if not item:
        raise HTTPException(status_code=404, detail="滞销库存风险不存在或缺少真实运营指标")

    existing = await _existing_open_record(db, user_id, listing_id)
    if existing:
        return existing

    capital = item.get("capital_rmb")
    return await create_record(db, user_id, {
        "record_type": "listing_optimization",
        "status": "operation_pending",
        "name": f"滞销库存资金处置：{item['title']}",
        "platform": item.get("platform"),
        "market": item.get("market"),
        "counterparty": item.get("account_name") or "平台店铺",
        "planned_amount_rmb": 0,
        "actual_amount_rmb": None,
        "currency": "CNY",
        "notes": _notes(item),
        "metrics": {
            "risk_type": "slow_moving_listing",
            "views_30d": item.get("views_30d"),
            "orders_30d": item.get("orders_30d"),
            "stock": item.get("stock"),
            "capital_rmb": capital,
        },
        "extra": {
            "source": "inventory_risk_workbench",
            "risk_type": "slow_moving_listing",
            "listing_id": item["listing_id"],
            "product_id": item["product_id"],
            "platform_account_id": item.get("platform_account_id"),
            "route": item.get("route"),
        },
    })


async def _existing_open_record(db: AsyncSession, user_id: str, listing_id: str) -> OperationRecord | None:
    result = await db.execute(
        select(OperationRecord).where(
            OperationRecord.user_id == user_id,
            OperationRecord.record_type == "listing_optimization",
            OperationRecord.status != "completed",
        ).order_by(OperationRecord.updated_at.desc())
    )
    for record in result.scalars().all():
        extra = record.extra if isinstance(record.extra, dict) else {}
        if (
            extra.get("source") == "inventory_risk_workbench"
            and extra.get("risk_type") == "slow_moving_listing"
            and extra.get("listing_id") == listing_id
        ):
            return record
    return None


def _notes(item: dict) -> str:
    capital = item.get("capital_rmb")
    capital_text = f"，占用库存资金 ¥{capital}" if capital is not None else ""
    return (
        f"库存风险工作台识别为滞销 Listing：近30天浏览 {item.get('views_30d')}、"
        f"订单 {item.get('orders_30d')}、当前库存 {item.get('stock')}{capital_text}。"
        "请复核主图、标题、价格、促销、评价和平台属性，不自动生成财务流水。"
    )

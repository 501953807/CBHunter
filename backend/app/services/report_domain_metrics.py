"""Cross-domain report metrics sourced from persisted finance, fulfillment and inventory records."""

from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.inventory_alert import InventoryAlertLog
from app.models.shipment import Shipment
from app.services.evidence_service import source_ref


def _bounds(label: str, period: str) -> tuple[datetime, datetime]:
    try:
        start = (datetime.strptime(label, "%Y-%m") if period == "monthly" else datetime.fromisoformat(label)).replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        start = datetime.now(timezone.utc)
    if period == "daily":
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, start + timedelta(days=1)
    if period == "weekly":
        return start, start + timedelta(days=7)
    start = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, next_month


async def aggregate_domain_metrics(db: AsyncSession, user_id: str, order_ids: list[str], label: str, period: str) -> dict:
    if db is None:
        return {
            "finance": {"income": 0, "expenses": 0, "net_cash_flow": 0, "entry_count": 0},
            "fulfillment": {"shipment_count": 0, "tracked_count": 0, "delivered_count": 0, "delivery_rate_pct": None},
            "inventory": {"open_alerts": 0, "critical_alerts": 0},
            "source_refs": [], "data_gaps": [],
        }
    start, end = _bounds(label, period)
    finance = list((await db.execute(select(FinanceLedgerEntry).where(
        FinanceLedgerEntry.user_id == user_id,
        FinanceLedgerEntry.occurred_at >= start,
        FinanceLedgerEntry.occurred_at < end,
    ))).scalars().all())
    shipments = []
    if order_ids:
        shipments = list((await db.execute(select(Shipment).where(
            Shipment.user_id == user_id, Shipment.order_id.in_(order_ids)
        ))).scalars().all())
    alerts = list((await db.execute(select(InventoryAlertLog).where(
        InventoryAlertLog.user_id == user_id, InventoryAlertLog.status == "open"
    ))).scalars().all())

    income_types = {"sales_income", "receivable_collection"}
    expense_types = {"purchase_cost", "domestic_shipping", "shipping_cost", "platform_fee", "advertising_cost", "influencer_cost"}
    income = sum(item.amount_rmb for item in finance if item.entry_type in income_types)
    expenses = sum(item.amount_rmb for item in finance if item.entry_type in expense_types)
    delivered = sum(1 for item in shipments if item.status == "delivered")
    tracked = sum(1 for item in shipments if item.tracking_number)
    gaps = []
    if not finance:
        gaps.append("期间没有财务台账记录")
    if order_ids and not shipments:
        gaps.append("期间订单没有关联物流单")
    if shipments and tracked < len(shipments):
        gaps.append(f"{len(shipments) - tracked} 个物流单缺少运单号")
    refs = [source_ref("finance_entry", item.id, label=item.entry_type) for item in finance[:30]]
    refs += [source_ref("shipment", item.id, label=item.tracking_number or item.id) for item in shipments[:30]]
    refs += [source_ref("inventory_alert", item.id, label=item.sku) for item in alerts[:30]]
    return {
        "finance": {
            "income": round(income, 2) if finance else None,
            "expenses": round(expenses, 2) if finance else None,
            "net_cash_flow": round(income - expenses, 2) if finance else None,
            "entry_count": len(finance),
        },
        "fulfillment": {"shipment_count": len(shipments), "tracked_count": tracked, "delivered_count": delivered, "delivery_rate_pct": round(delivered / len(shipments) * 100, 1) if shipments else None},
        "inventory": {"open_alerts": len(alerts), "critical_alerts": sum(1 for item in alerts if item.severity == "critical")},
        "source_refs": refs,
        "data_gaps": gaps,
    }

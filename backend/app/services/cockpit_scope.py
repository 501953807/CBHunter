"""Scope helpers for operating cockpit filters."""

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance_ledger import FinanceLedgerEntry
from app.models.order import Order
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.services.finance_service import CASH_BALANCE_TYPE, REVENUE_TYPES
from app.services.store_access_service import list_accessible_store_ids_for_user_id


async def scoped_store_ids(
    db: AsyncSession,
    user_id: str,
    *,
    platform: Optional[str],
    platform_account_id: Optional[str],
) -> list[str]:
    accessible = await list_accessible_store_ids_for_user_id(db, user_id)
    if not accessible:
        return []
    query = select(PlatformAccount.id).where(PlatformAccount.id.in_(accessible))
    if platform_account_id:
        query = query.where(PlatformAccount.id == platform_account_id)
    if platform:
        query = query.where(PlatformAccount.platform == platform)
    return list((await db.execute(query)).scalars().all())


async def account_markets(db: AsyncSession, store_ids: list[str]) -> dict[str, str]:
    if not store_ids:
        return {}
    result = await db.execute(select(PlatformAccount).where(PlatformAccount.id.in_(store_ids)))
    markets = {}
    for account in result.scalars().all():
        settings = account.settings if isinstance(account.settings, dict) else {}
        if settings.get("market"):
            markets[account.id] = settings["market"]
    return markets


def resolve_window(now: datetime, start_date: Optional[date], end_date: Optional[date]) -> tuple[datetime, datetime]:
    end_day = end_date or now.date()
    start_day = start_date or (end_day - timedelta(days=29))
    if start_day > end_day:
        start_day, end_day = end_day, start_day
    start_at = datetime.combine(start_day, time.min, tzinfo=timezone.utc)
    end_exclusive = datetime.combine(end_day + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return start_at, end_exclusive


def finance_summary_from_entries(entries: list[FinanceLedgerEntry]) -> dict:
    revenue_entries = [entry for entry in entries if entry.entry_type in REVENUE_TYPES]
    cost_entries = [
        entry for entry in entries
        if entry.entry_type not in REVENUE_TYPES and entry.entry_type != CASH_BALANCE_TYPE
    ]
    total_revenue = sum_amount(revenue_entries) if revenue_entries else None
    total_cost = sum_amount(cost_entries) if cost_entries else None
    net_profit = None
    profit_margin = None
    if total_revenue is not None and total_cost is not None:
        net_profit = round(total_revenue - total_cost, 2)
        profit_margin = round((net_profit / total_revenue) * 100, 1) if total_revenue else None
    return {
        "period": "custom",
        "total_revenue_rmb": total_revenue,
        "total_cost_rmb": total_cost,
        "net_profit_rmb": net_profit,
        "profit_margin_pct": profit_margin,
        "cash_balance_rmb": latest_cash_balance(entries),
        "entry_count": len(entries),
    }


def scoped_report(report: dict, orders: list[Order], end_exclusive: datetime, has_scope: bool) -> dict:
    if not has_scope:
        return report
    report_date = (end_exclusive - timedelta(microseconds=1)).date()
    today_orders = [item for item in orders if item.ordered_at and item.ordered_at.date() == report_date]
    return {
        "summary": {"total_orders": len(today_orders)},
        "data_quality": {
            "cost_status": "not_evaluated",
            "missing_cost_items": 0,
        },
    }


def order_market(order: Order) -> str:
    platform_account = getattr(order, "platform_account", None)
    account_settings = platform_account.settings if platform_account and isinstance(platform_account.settings, dict) else {}
    platform_data = order.platform_data if isinstance(order.platform_data, dict) else {}
    return account_settings.get("market") or platform_data.get("market") or "unknown"


def listing_market(item: PlatformListing, markets_by_account: dict[str, str]) -> str:
    platform_data = item.platform_data if isinstance(item.platform_data, dict) else {}
    return markets_by_account.get(item.platform_account_id) or platform_data.get("market") or "unknown"


def sum_amount(entries: list[FinanceLedgerEntry]) -> float:
    return round(sum(entry.amount_rmb for entry in entries), 2)


def latest_cash_balance(entries: list[FinanceLedgerEntry]) -> Optional[float]:
    for entry in entries:
        if entry.entry_type == CASH_BALANCE_TYPE:
            return entry.amount_rmb
    return None

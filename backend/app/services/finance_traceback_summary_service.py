"""Traceback summary helpers for finance ledger."""

from app.models.finance_ledger import FinanceLedgerEntry


def build_finance_traceback_summary(
    *,
    entries: list[FinanceLedgerEntry],
    order_count: int,
    product_count: int,
    store_count: int,
    revenue_types: set[str],
    non_profit_loss_types: set[str],
    settlement_movement_types: tuple[str, ...],
    platform_bill_types: set[str],
) -> dict:
    """Build real-ledger totals for finance traceback summary."""
    revenue_entries = [entry for entry in entries if entry.entry_type in revenue_types]
    cost_entries = [
        entry for entry in entries
        if entry.entry_type not in revenue_types and entry.entry_type not in non_profit_loss_types
    ]
    total_revenue = _sum_amount(revenue_entries) if revenue_entries else None
    total_cost = _sum_amount(cost_entries) if cost_entries else None
    net_profit = None
    if total_revenue is not None and total_cost is not None:
        net_profit = round(total_revenue - total_cost, 2)
    refund_total = _sum_amount([entry for entry in entries if entry.entry_type == "refund"])
    platform_bill_total = _sum_amount([entry for entry in entries if entry.entry_type in platform_bill_types])
    settlement_movement_total = _sum_amount([
        entry for entry in entries
        if entry.entry_type in settlement_movement_types
    ])
    return {
        "order_count": order_count,
        "product_count": product_count,
        "store_count": store_count,
        "entry_count": len(entries),
        "total_revenue_rmb": total_revenue,
        "total_cost_rmb": total_cost,
        "net_profit_rmb": net_profit,
        "refund_rmb": refund_total,
        "platform_bill_rmb": platform_bill_total,
        "settlement_movement_rmb": settlement_movement_total,
    }


def _sum_amount(entries: list[FinanceLedgerEntry]) -> float:
    return round(sum(entry.amount_rmb for entry in entries), 2)

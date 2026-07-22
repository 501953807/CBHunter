"""Risk source summary helpers for risk-control overview."""


def build_risk_source_summary(
    active_risks: list[dict],
    inventory_workbench: dict,
    finance_summary: dict,
    order_stats: dict,
) -> list[dict]:
    fulfillment = order_stats.get("fulfillment") or {}
    stockout = inventory_workbench.get("stockout") or {}
    finance_signals = finance_summary.get("risk_signals") or []
    profit_signal_codes = {"negative_profit", "cost_missing", "purchase_cost_missing", "platform_bill_missing"}
    profit_signals = [item for item in finance_signals if item.get("code") in profit_signal_codes]
    logistics_active = [item for item in active_risks if item.get("type") == "logistics"]
    inventory_active = [item for item in active_risks if item.get("type") == "inventory"]
    currency_active = [item for item in active_risks if item.get("type") == "currency"]
    overdue_count = int(fulfillment.get("overdue") or 0)
    due_soon_count = int(fulfillment.get("due_soon") or 0)
    stockout_count = int(stockout.get("count") or 0)
    profit_count = len(profit_signals)
    return [
        {
            "key": "fulfillment_overdue",
            "label": "履约超时",
            "count": overdue_count,
            "secondary_count": due_soon_count,
            "secondary_label": "临近超期",
            "active_risk_count": len(logistics_active),
            "severity": "critical" if overdue_count else "warning" if due_soon_count else "clear",
            "route": "/orders?shipping_sla=overdue",
            "description": "按当前用户可访问店铺订单的平台开户发货时限识别超期和临近超期。",
            "data_gaps": order_stats.get("data_gaps") or [],
        },
        {
            "key": "inventory_stockout",
            "label": "库存断货",
            "count": stockout_count,
            "secondary_count": len(inventory_workbench.get("slow_moving", {}).get("items") or []),
            "secondary_label": "滞销资金",
            "active_risk_count": len(inventory_active),
            "severity": "critical" if stockout_count else "warning" if inventory_active else "clear",
            "route": "/products?tab=platform_store_products",
            "description": "按库存预警规则和平台店铺 Listing 库存识别缺货、断货与库存资金风险。",
            "data_gaps": inventory_workbench.get("data_gaps") or [],
        },
        {
            "key": "profit_anomaly",
            "label": "利润异常",
            "count": profit_count,
            "secondary_count": len(currency_active),
            "secondary_label": "财务风险",
            "active_risk_count": len(currency_active),
            "severity": "critical" if any(item.get("level") == "high" for item in profit_signals) else "warning" if profit_count else "clear",
            "route": "/finance#finance-ledger",
            "description": "按真实财务台账中的收入、成本、平台费和净利润信号识别利润异常。",
            "data_gaps": finance_summary.get("data_gaps") or [],
        },
    ]

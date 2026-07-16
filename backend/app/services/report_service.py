"""Report service — real data aggregation from orders/order_items/products."""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.order import Order
from app.models.product import Product
from app.models.report_subscription import ReportSubscription
from app.services.evidence_service import evidence_payload, source_ref
from app.services.finance_service import get_finance_summary
from app.services.store_access_service import list_accessible_store_ids_for_user_id
from app.services.report_domain_metrics import aggregate_domain_metrics

logger = logging.getLogger(__name__)


async def generate_daily_report(db: AsyncSession, user_id: str, date_str: str) -> dict:
    """Aggregate daily report for a given date (ISO format YYYY-MM-DD)."""
    try:
        date = datetime.fromisoformat(date_str)
    except (ValueError, TypeError):
        date = datetime.now(timezone.utc)

    day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    orders = await _get_orders_in_range(db, user_id, day_start, day_end)
    previous_orders = await _get_orders_in_range(
        db, user_id, day_start - timedelta(days=1), day_start
    )
    return await _build_report(db, user_id, orders, date_str, "daily", previous_orders)


async def generate_weekly_report(db: AsyncSession, user_id: str, week_start_str: str) -> dict:
    """Aggregate weekly report."""
    try:
        week_start = datetime.fromisoformat(week_start_str)
    except (ValueError, TypeError):
        week_start = datetime.now(timezone.utc) - timedelta(days=7)

    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    orders = await _get_orders_in_range(db, user_id, week_start, week_end)
    previous_orders = await _get_orders_in_range(
        db, user_id, week_start - timedelta(days=7), week_start
    )
    return await _build_report(db, user_id, orders, week_start_str, "weekly", previous_orders)


async def generate_monthly_report(db: AsyncSession, user_id: str, month_str: str) -> dict:
    """Aggregate monthly report."""
    try:
        month_start = datetime.fromisoformat(month_str + "-01") if len(month_str) <= 7 else datetime.fromisoformat(month_str)
    except (ValueError, TypeError):
        month_start = datetime.now(timezone.utc).replace(day=1)

    month_start = month_start.replace(hour=0, minute=0, second=0, microsecond=0)
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)

    orders = await _get_orders_in_range(db, user_id, month_start, month_end)
    period_length = month_end - month_start
    previous_orders = await _get_orders_in_range(
        db, user_id, month_start - period_length, month_start
    )
    return await _build_report(db, user_id, orders, month_str, "monthly", previous_orders)


async def detect_anomalies(db: AsyncSession, user_id: str) -> list[dict]:
    """Detect anomalies by comparing today vs 7-day moving average."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Today's metrics
    today_orders = await _get_orders_in_range(db, user_id, today_start, today_end)
    today_revenue = sum(o.total or 0 for o in today_orders)
    today_count = len(today_orders)

    # 7-day average
    seven_days_ago = today_start - timedelta(days=7)
    hist_orders = await _get_orders_in_range(db, user_id, seven_days_ago, today_start)
    hist_days = max((today_start - seven_days_ago).days, 1)
    hist_revenue = sum(o.total or 0 for o in hist_orders) / hist_days
    hist_count = len(hist_orders) / hist_days

    anomalies = []

    # Revenue anomaly
    if hist_revenue > 0:
        rev_dev = abs(today_revenue - hist_revenue) / hist_revenue * 100
        if rev_dev > 20:
            anomalies.append({
                "metric": "revenue",
                "expected": round(hist_revenue, 2),
                "actual": round(today_revenue, 2),
                "deviation_pct": round(rev_dev, 1),
                **_anomaly_evidence(today_orders, hist_orders, today_start, today_end),
            })

    # Order count anomaly
    if hist_count > 0:
        cnt_dev = abs(today_count - hist_count) / hist_count * 100
        if cnt_dev > 20:
            anomalies.append({
                "metric": "orders",
                "expected": round(hist_count, 1),
                "actual": today_count,
                "deviation_pct": round(cnt_dev, 1),
                **_anomaly_evidence(today_orders, hist_orders, today_start, today_end),
            })

    finance_summary = await get_finance_summary(
        db,
        user_id,
        "daily",
        start_at=today_start,
        end_at=today_end,
    )
    for signal in finance_summary.get("risk_signals") or []:
        anomalies.append({
            "metric": "financial_risk",
            "risk_code": signal.get("code"),
            "title": signal.get("title") or "财务风险",
            "expected": "无财务风险",
            "actual": signal.get("title") or signal.get("code") or "财务风险",
            "deviation_pct": 100,
            "level": signal.get("level"),
            "detail": signal.get("detail"),
            "action_label": signal.get("action_label"),
            "action_route": signal.get("action_route"),
            "source_refs": finance_summary.get("source_refs") or [],
            "evidence_window": f"今日财务台账风险：{finance_summary.get('evidence_window') or ''}",
            "confidence_reason": "异常检测复用财务护卫后端 risk_signals，只基于真实财务台账生成财务异常。",
            "data_gaps": finance_summary.get("data_gaps") or [],
        })

    return anomalies


# ── Subscriptions ──

async def list_subscriptions(db: AsyncSession, user_id: str) -> list[ReportSubscription]:
    result = await db.execute(
        select(ReportSubscription).where(ReportSubscription.user_id == user_id)
    )
    return list(result.scalars().all())


async def create_subscription(
    db: AsyncSession, user_id: str, channel: str, frequency: str
) -> ReportSubscription:
    if channel != "in_app":
        raise ValueError("当前仅支持站内通知；外部推送渠道尚未配置")
    if frequency not in {"daily", "weekly", "monthly"}:
        raise ValueError("不支持的报表频率")
    existing = await db.execute(
        select(ReportSubscription).where(
            ReportSubscription.user_id == user_id,
            ReportSubscription.channel == channel,
            ReportSubscription.frequency == frequency,
            ReportSubscription.enabled == True,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("相同频率的站内报表订阅已存在")
    sub = ReportSubscription(user_id=user_id, channel=channel, frequency=frequency)
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


async def delete_subscription(db: AsyncSession, sub_id: str, user_id: str) -> bool:
    result = await db.execute(
        select(ReportSubscription).where(
            and_(ReportSubscription.id == sub_id, ReportSubscription.user_id == user_id)
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return False
    await db.delete(sub)
    await db.commit()
    return True


# ── Helpers ──

async def _get_orders_in_range(db: AsyncSession, user_id: str, start: datetime, end: datetime) -> list[Order]:
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    if not store_ids:
        return []
    result = await db.execute(
        select(Order)
        .where(
            and_(
                Order.platform_account_id.in_(store_ids),
                Order.ordered_at >= start,
                Order.ordered_at < end,
            )
        )
        .order_by(Order.ordered_at.desc())
    )
    return list(result.scalars().all())


async def _build_report(
    db: AsyncSession,
    user_id: str,
    orders: list[Order],
    date_label: str,
    period: str,
    previous_orders: Optional[list[Order]] = None,
) -> dict:
    total_revenue = sum(o.total or 0 for o in orders)
    total_orders = len(orders)
    known_total_cost = 0.0
    total_items = 0
    costed_items = 0
    missing_cost_items = 0

    # Aggregate cost from order items
    for order in orders:
        for item in (order.items or []):
            total_items += 1
            # Try to get product cost
            if item.product_id:
                prod_result = await db.execute(
                    select(Product).where(
                        Product.id == item.product_id,
                        Product.user_id == user_id,
                    )
                )
                product = prod_result.scalar_one_or_none()
                if product and product.cost_price is not None and product.cost_price >= 0:
                    known_total_cost += product.cost_price * item.quantity
                    costed_items += 1
                    continue
            missing_cost_items += 1

    cost_complete = total_items > 0 and missing_cost_items == 0
    total_cost = round(known_total_cost, 2) if cost_complete else None
    gross_profit = round(total_revenue - known_total_cost, 2) if cost_complete else None
    profit_margin_pct = (
        round(gross_profit / total_revenue * 100, 1)
        if gross_profit is not None and total_revenue > 0
        else None
    )

    # By platform breakdown (from order items with product data)
    by_platform: dict[str, dict] = {}
    for order in orders:
        platform = "unknown"
        if order.platform_account:
            platform = order.platform_account.platform or "unknown"
        if platform not in by_platform:
            by_platform[platform] = {"revenue": 0.0, "orders": 0}
        by_platform[platform]["revenue"] += order.total or 0
        by_platform[platform]["orders"] += 1

    by_platform_list = [
        {"platform": k, "revenue": round(v["revenue"], 2), "orders": v["orders"]}
        for k, v in by_platform.items()
    ]

    by_market: dict[str, dict] = {}
    for order in orders:
        market = _order_market(order)
        if market not in by_market:
            by_market[market] = {"revenue": 0.0, "orders": 0}
        by_market[market]["revenue"] += order.total or 0
        by_market[market]["orders"] += 1
    by_market_list = [
        {"platform": market, "revenue": round(values["revenue"], 2), "orders": values["orders"]}
        for market, values in by_market.items()
    ]

    # Top products
    product_qty: dict[str, dict] = {}
    for order in orders:
        for item in (order.items or []):
            name = item.name or "Unknown"
            if name not in product_qty:
                product_qty[name] = {"quantity": 0, "revenue": 0.0}
            product_qty[name]["quantity"] += item.quantity or 0
            product_qty[name]["revenue"] += item.total_price or 0

    top_products = sorted(
        [{"name": k, "quantity": v["quantity"], "revenue": round(v["revenue"], 2)}
         for k, v in product_qty.items()],
        key=lambda x: x["revenue"], reverse=True
    )[:10]

    anomalies = _detect_period_anomalies(orders, previous_orders)
    data_gaps = []
    if not orders:
        data_gaps.append("期间没有真实订单记录")
    if missing_cost_items:
        data_gaps.append(f"{missing_cost_items} 个订单商品缺采购成本")
    if previous_orders is None:
        data_gaps.append("缺少上一个同天数日期范围对比样本")
    elif not previous_orders:
        data_gaps.append("上一个同天数日期范围没有真实订单记录")
    refs = [
        source_ref("order", str(order_id))
        for order in orders[:50]
        if (order_id := getattr(order, "id", None)) is not None
    ]
    domains = await aggregate_domain_metrics(
        db, user_id,
        [order_id for order in orders if (order_id := getattr(order, "id", None)) is not None],
        date_label, period,
    )
    refs.extend(domains["source_refs"])
    data_gaps.extend(domains["data_gaps"])
    financial_risk_signals = []
    if db is not None:
        report_start, report_end = _report_bounds(date_label, period)
        finance_summary = await get_finance_summary(
            db,
            user_id,
            period,
            start_at=report_start,
            end_at=report_end,
        )
        financial_risk_signals = finance_summary.get("risk_signals") or []
        refs.extend(finance_summary.get("source_refs") or [])
        data_gaps.extend(finance_summary.get("data_gaps") or [])

    return {
        "date": date_label,
        "period": period,
        **evidence_payload(
            source_refs=refs,
            evidence_window=f"{period}:{date_label}",
            confidence_reason="报表仅聚合当前用户已同步订单、订单明细和商品成本，不补造收入或成本。",
            data_gaps=data_gaps,
        ),
        "gaps": data_gaps,
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "total_cost": total_cost,
            "gross_profit": gross_profit,
            "profit_margin_pct": profit_margin_pct,
        },
        "by_platform": by_platform_list,
        "by_market": by_market_list,
        "top_products": top_products,
        "anomalies": anomalies,
        "financial_risk_signals": financial_risk_signals,
        "cross_domain": {key: domains[key] for key in ("finance", "fulfillment", "inventory")},
        "data_quality": {
            "cost_status": "complete" if cost_complete else "missing",
            "total_items": total_items,
            "costed_items": costed_items,
            "missing_cost_items": missing_cost_items,
            "finance_risk_count": len(financial_risk_signals),
            "comparison_status": "ready" if previous_orders is not None else "not_evaluated",
        },
    }


def _report_bounds(label: str, period: str) -> tuple[datetime, datetime]:
    try:
        start = (datetime.strptime(label, "%Y-%m") if period == "monthly" else datetime.fromisoformat(label)).replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        start = datetime.now(timezone.utc)
    if period == "daily":
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, start + timedelta(days=1)
    if period == "weekly":
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, start + timedelta(days=7)
    start = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, next_month


def _order_market(order: Order) -> str:
    """Read only explicit market values attached to the account or order."""
    platform_account = getattr(order, "platform_account", None)
    account_settings = (
        platform_account.settings
        if platform_account and isinstance(platform_account.settings, dict)
        else {}
    )
    raw_platform_data = getattr(order, "platform_data", None)
    platform_data = raw_platform_data if isinstance(raw_platform_data, dict) else {}
    return account_settings.get("market") or platform_data.get("market") or "unknown"


def _detect_period_anomalies(
    orders: list[Order],
    previous_orders: Optional[list[Order]],
) -> list[dict]:
    """Compare the report period with the immediately preceding equal-length period."""
    if previous_orders is None:
        return []

    current_revenue = sum(order.total or 0 for order in orders)
    previous_revenue = sum(order.total or 0 for order in previous_orders)
    metrics = (
        ("revenue", current_revenue, previous_revenue),
        ("orders", len(orders), len(previous_orders)),
    )
    anomalies = []
    for metric, actual, expected in metrics:
        if expected <= 0:
            continue
        deviation = abs(actual - expected) / expected * 100
        if deviation > 20:
            anomalies.append({
                "metric": metric,
                "expected": round(expected, 2),
                "actual": round(actual, 2),
                "deviation_pct": round(deviation, 1),
                **_anomaly_evidence(orders, previous_orders, None, None),
            })
    return anomalies


def _anomaly_evidence(
    current_orders: list[Order],
    previous_orders: list[Order],
    start: Optional[datetime],
    end: Optional[datetime],
) -> dict:
    refs = [
        source_ref("order", str(order_id))
        for order in (current_orders + previous_orders)[:50]
        if (order_id := getattr(order, "id", None)) is not None
    ]
    if start and end:
        window = f"{start.isoformat()} 至 {end.isoformat()}，并对比前置样本"
    else:
        window = "当前报表日期范围与上一个同天数日期范围"
    gaps = []
    if not current_orders:
        gaps.append("当前报表日期区间没有真实订单")
    if not previous_orders:
        gaps.append("上一个同天数日期范围没有真实订单")
    return evidence_payload(
        source_refs=refs,
        evidence_window=window,
        confidence_reason="异常检测只在存在上一个同天数日期范围或历史均值样本时计算偏差。",
        data_gaps=gaps,
    )

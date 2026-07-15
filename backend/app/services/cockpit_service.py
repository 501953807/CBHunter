"""Traceable operating cockpit assembled only from persisted business data."""

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_suggestion import AISuggestion
from app.models.competitor_product import CompetitorProduct
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.inventory_alert import InventoryAlertLog
from app.models.operation_record import OperationRecord
from app.models.order import Order
from app.models.platform_listing import PlatformListing
from app.services.cockpit_scope import (
    account_markets,
    finance_summary_from_entries,
    listing_market,
    order_market,
    resolve_window,
    scoped_report,
    scoped_store_ids,
)
from app.services.cockpit_center_summary_service import build_cockpit_center_summaries
from app.services.report_service import detect_anomalies, generate_daily_report
from app.services.evidence_service import evidence_payload, source_ref, unique_refs
from app.services.order_service import build_fulfillment_exception_context

REFERENCE_LIMIT = 20
SOURCE_META = {
    "order": ("订单", "/orders"),
    "finance_ledger_entry": ("财务台账", "/finance"),
    "platform_listing": ("平台 Listing", "/inventory-alerts"),
    "competitor_product": ("竞品快照", "/monitor"),
    "inventory_alert_log": ("库存预警", "/inventory-alerts"),
    "ai_suggestion": ("AI 运营建议", "/ai-suggestions"),
    "operation_record": ("运营台账", "/operations"),
}


async def get_operating_cockpit(
    db: AsyncSession,
    user_id: str,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    platform: Optional[str] = None,
    market: Optional[str] = None,
    platform_account_id: Optional[str] = None,
    currency: Optional[str] = None,
) -> dict:
    """Build the cockpit without mixing currencies or inventing missing values."""
    now = datetime.now(timezone.utc)
    start_at, end_exclusive = resolve_window(now, start_date, end_date)
    store_ids = await scoped_store_ids(db, user_id, platform=platform, platform_account_id=platform_account_id)

    order_query = select(Order).where(
        Order.platform_account_id.in_(store_ids),
        Order.ordered_at >= start_at,
        Order.ordered_at < end_exclusive,
    )
    if currency:
        order_query = order_query.where(Order.currency == currency)
    orders = list((await db.execute(order_query.order_by(Order.ordered_at.desc()))).scalars().all())
    if market:
        orders = [item for item in orders if order_market(item) == market]

    listings = list((await db.execute(
        select(PlatformListing).where(
            PlatformListing.platform_account_id.in_(store_ids),
            PlatformListing.status == "active",
        ).order_by(PlatformListing.updated_at.desc())
    )).scalars().all())
    if market:
        markets_by_account = await account_markets(db, store_ids)
        listings = [item for item in listings if listing_market(item, markets_by_account) == market]
    listing_ids = {item.id for item in listings}

    operation_records = list((await db.execute(
        select(OperationRecord)
        .where(OperationRecord.user_id == user_id)
        .order_by(OperationRecord.updated_at.desc())
    )).scalars().all())
    operation_records = [
        item for item in operation_records
        if (item.extra or {}).get("source") == "product_operation_metric"
        and (item.extra or {}).get("listing_id") in listing_ids
    ]

    alerts = list((await db.execute(
        select(InventoryAlertLog).where(
            InventoryAlertLog.user_id == user_id,
            InventoryAlertLog.status == "open",
            InventoryAlertLog.created_at >= start_at,
            InventoryAlertLog.created_at < end_exclusive,
        ).order_by(InventoryAlertLog.created_at.desc())
    )).scalars().all())
    competitor_query = select(CompetitorProduct).where(
        CompetitorProduct.user_id == user_id,
        CompetitorProduct.is_tracked.is_(True),
    )
    if platform:
        competitor_query = competitor_query.where(CompetitorProduct.platform == platform)
    if market:
        competitor_query = competitor_query.where(CompetitorProduct.market == market)
    if currency:
        competitor_query = competitor_query.where(CompetitorProduct.currency == currency)
    competitors = list((await db.execute(competitor_query.order_by(CompetitorProduct.last_updated.desc()))).scalars().all())

    suggestions = list((await db.execute(
        select(AISuggestion).where(
            AISuggestion.user_id == user_id,
            AISuggestion.is_dismissed.is_(False),
            AISuggestion.created_at >= start_at,
            AISuggestion.created_at < end_exclusive,
        ).order_by(AISuggestion.is_read, AISuggestion.created_at.desc()).limit(20)
    )).scalars().all())
    ledger_query = select(FinanceLedgerEntry).where(
        FinanceLedgerEntry.user_id == user_id,
        FinanceLedgerEntry.occurred_at >= start_at,
        FinanceLedgerEntry.occurred_at < end_exclusive,
    )
    if platform:
        ledger_query = ledger_query.where(FinanceLedgerEntry.platform == platform)
    if market:
        ledger_query = ledger_query.where(FinanceLedgerEntry.market == market)
    if currency:
        ledger_query = ledger_query.where(FinanceLedgerEntry.currency == currency)
    ledger_entries = list((await db.execute(ledger_query.order_by(FinanceLedgerEntry.occurred_at.desc()))).scalars().all())

    finance = finance_summary_from_entries(ledger_entries)
    comparison = await _period_comparison(
        db,
        user_id,
        store_ids,
        start_at=start_at,
        end_exclusive=end_exclusive,
        platform=platform,
        market=market,
        currency=currency,
    )
    report_date = (end_exclusive - timedelta(microseconds=1)).date().isoformat()
    report = await generate_daily_report(db, user_id, report_date)
    anomalies = await detect_anomalies(db, user_id)
    scoped_report_data = scoped_report(report, orders, end_exclusive, has_scope=any([platform, market, platform_account_id, currency, start_date, end_date]))

    sections = {
        "orders": _orders_section(orders, start_at, end_exclusive),
        "finance": _finance_section(finance, ledger_entries, len(orders), start_at, end_exclusive),
        "inventory": _inventory_section(listings, alerts, now),
        "product_operations": _product_operations_section(listings, operation_records, now),
        "competitors": _competitor_section(competitors, now),
        "alerts": _alerts_section(alerts, now),
        "reports": _report_section(scoped_report_data, anomalies, orders, now),
        "ai_suggestions": _suggestion_section(suggestions, now),
    }
    sections.update(await build_cockpit_center_summaries(
        db, user_id, store_ids, orders=orders, listings=listings, alerts=alerts,
        ledger_entries=ledger_entries, competitors=competitors, suggestions=suggestions,
        anomalies=anomalies, sections=sections, now=now,
    ))
    source_refs = unique_refs([ref for item in sections.values() for ref in item["source_refs"]])
    data_gaps = [gap for item in sections.values() for gap in item["data_gaps"]]
    return {
        "generated_at": now.isoformat(),
        "data_status": "ready" if any(item["source_count"] for item in sections.values()) else "data_required",
        "attention_count": len(alerts) + len(anomalies) + sum(
            1 for item in suggestions if item.severity == "critical" and not item.is_read
        ),
        "source_refs": source_refs,
        "evidence_window": _window(start_at, end_exclusive),
        "confidence_reason": (
            "经营指挥台仅汇总当前筛选范围内的已入库订单、Listing、库存预警、竞品、财务台账、报表异常和 AI 建议。"
        ),
        "data_gaps": data_gaps,
        "active_filters": {
            "start_date": start_at.date().isoformat(),
            "end_date": (end_exclusive - timedelta(microseconds=1)).date().isoformat(),
            "platform": platform,
            "market": market,
            "platform_account_id": platform_account_id,
            "currency": currency,
            "store_count": len(store_ids),
        },
        "comparison": comparison,
        "sections": sections,
    }


async def _period_comparison(
    db: AsyncSession,
    user_id: str,
    store_ids: list[str],
    *,
    start_at: datetime,
    end_exclusive: datetime,
    platform: Optional[str],
    market: Optional[str],
    currency: Optional[str],
) -> dict:
    duration = end_exclusive - start_at
    previous_start = start_at - duration
    previous_end = start_at
    year_start = start_at - timedelta(days=365)
    year_end = end_exclusive - timedelta(days=365)

    current = await _period_snapshot(db, user_id, store_ids, start_at, end_exclusive, platform=platform, market=market, currency=currency)
    previous = await _period_snapshot(db, user_id, store_ids, previous_start, previous_end, platform=platform, market=market, currency=currency)
    last_year = await _period_snapshot(db, user_id, store_ids, year_start, year_end, platform=platform, market=market, currency=currency)
    return {
        "current": current,
        "previous": previous,
        "last_year": last_year,
        "rates": {
            "orders_mom_pct": _change_pct(current["orders"], previous["orders"]),
            "orders_yoy_pct": _change_pct(current["orders"], last_year["orders"]),
            "revenue_mom_pct": _change_pct(current["revenue_rmb"], previous["revenue_rmb"]),
            "revenue_yoy_pct": _change_pct(current["revenue_rmb"], last_year["revenue_rmb"]),
            "profit_mom_pct": _change_pct(current["net_profit_rmb"], previous["net_profit_rmb"]),
            "profit_yoy_pct": _change_pct(current["net_profit_rmb"], last_year["net_profit_rmb"]),
        },
        "windows": {
            "current": _window(start_at, end_exclusive),
            "previous": _window(previous_start, previous_end),
            "last_year": _window(year_start, year_end),
        },
    }


async def _period_snapshot(
    db: AsyncSession,
    user_id: str,
    store_ids: list[str],
    start_at: datetime,
    end_exclusive: datetime,
    *,
    platform: Optional[str],
    market: Optional[str],
    currency: Optional[str],
) -> dict:
    order_query = select(Order).where(
        Order.platform_account_id.in_(store_ids),
        Order.ordered_at >= start_at,
        Order.ordered_at < end_exclusive,
    )
    if currency:
        order_query = order_query.where(Order.currency == currency)
    orders = list((await db.execute(order_query)).scalars().all())
    if market:
        orders = [item for item in orders if order_market(item) == market]

    ledger_query = select(FinanceLedgerEntry).where(
        FinanceLedgerEntry.user_id == user_id,
        FinanceLedgerEntry.occurred_at >= start_at,
        FinanceLedgerEntry.occurred_at < end_exclusive,
    )
    if platform:
        ledger_query = ledger_query.where(FinanceLedgerEntry.platform == platform)
    if market:
        ledger_query = ledger_query.where(FinanceLedgerEntry.market == market)
    if currency:
        ledger_query = ledger_query.where(FinanceLedgerEntry.currency == currency)
    ledger_entries = list((await db.execute(ledger_query)).scalars().all())
    finance = finance_summary_from_entries(ledger_entries)
    return {
        "orders": len(orders),
        "revenue_rmb": finance["total_revenue_rmb"],
        "cost_rmb": finance["total_cost_rmb"],
        "net_profit_rmb": finance["net_profit_rmb"],
        "ledger_entries": len(ledger_entries),
    }


def _change_pct(current, baseline):
    if current is None or baseline in (None, 0):
        return None
    return round(((current - baseline) / abs(baseline)) * 100, 2)

def _orders_section(orders: list[Order], start: datetime, now: datetime) -> dict:
    by_currency: dict[str, dict] = {}
    for order in orders:
        bucket = by_currency.setdefault(order.currency, {"currency": order.currency, "orders": 0, "revenue": 0.0})
        bucket["orders"] += 1
        bucket["revenue"] = round(bucket["revenue"] + order.total, 2)
    return _section(
        orders,
        "order",
        _window(start, now),
        metrics={"order_count": len(orders), "revenue_by_currency": list(by_currency.values())},
        items=[_order_section_item(order, now) for order in orders[:6]],
        gaps=[] if orders else ["近30天没有真实订单记录"],
    )


def _order_section_item(order: Order, now: datetime) -> dict:
    return {
        "id": order.id,
        "order_number": order.order_number or order.platform_order_id,
        "platform": order.platform_account.platform if order.platform_account else None,
        "platform_account_id": order.platform_account_id,
        "account_name": order.platform_account.account_name if order.platform_account else None,
        "status": order.status,
        "total": order.total,
        "currency": order.currency,
        "ordered_at": _iso(order.ordered_at),
        "fulfillment_exception": build_fulfillment_exception_context(order, now=now),
    }

def _finance_section(
    summary: dict,
    entries: list[FinanceLedgerEntry],
    order_count: int,
    start: datetime,
    now: datetime,
) -> dict:
    gaps = []
    actions = []
    if not entries:
        gaps.append("近30天没有人民币财务台账")
        actions.append(_action("录入财务台账", "/finance?entry_type=sales_income", "补录销售收入、采购成本和现金余额后再判断利润。"))
    if summary["net_profit_rmb"] is None and entries:
        gaps.append("收入或成本台账不完整，暂不计算净利润")
        actions.append(_action("补齐收入与成本台账", "/finance", "收入或成本缺失时不能计算净利润。"))
    if summary["total_revenue_rmb"] and order_count == 0:
        gaps.append("存在人民币收入台账，但近30天没有平台订单；请核对收入来源与发生时间")
        actions.append(_action("核对收入来源", "/finance?entry_type=sales_income", "收入台账与平台订单口径不一致。"))
    if summary["net_profit_rmb"] is not None and summary["net_profit_rmb"] < 0:
        gaps.append("净利润为负，请核对成本、平台费、物流费和售价策略")
        actions.extend([
            _action("核对成本与平台费用", "/finance?entry_type=purchase_cost", "先确认采购成本、平台费用和物流费用是否准确。"),
            _action("调整售价策略", "/smart/pricing", "成本确认后进入智能定价重新测算目标利润。"),
        ])
    return _section(
        entries,
        "finance_ledger_entry",
        _window(start, now),
        metrics=summary,
        items=[{
            "id": entry.id,
            "entry_type": entry.entry_type,
            "amount_rmb": entry.amount_rmb,
            "description": entry.description,
            "occurred_at": _iso(entry.occurred_at),
        } for entry in entries[:6]],
        gaps=gaps,
        actions=actions,
    )

def _inventory_section(listings: list[PlatformListing], alerts: list[InventoryAlertLog], now: datetime) -> dict:
    confirmed = [
        item for item in listings
        if (item.platform_data or {}).get("stock_status") != "missing"
    ]
    unknown = [item for item in listings if item not in confirmed]
    gaps = []
    if not confirmed:
        gaps.append("没有已确认库存的在售 Listing")
    if unknown:
        gaps.append(f"{len(unknown)} 个在售 Listing 库存状态未知")
    return _section(
        confirmed,
        "platform_listing",
        f"当前数据库快照，生成于 {_iso(now)}",
        metrics={
            "active_listings": len(listings),
            "confirmed_listings": len(confirmed),
            "confirmed_stock": sum(item.stock for item in confirmed),
            "unknown_stock_listings": len(unknown),
            "open_alerts": len(alerts),
        },
        items=[{
            "id": item.id,
            "title": item.title,
            "stock": item.stock,
            "status": item.status,
        } for item in confirmed[:6]],
        gaps=gaps,
    )

def _product_operations_section(
    listings: list[PlatformListing],
    operation_records: list[OperationRecord],
    now: datetime,
) -> dict:
    records_by_listing: dict[str, list[OperationRecord]] = {}
    for record in operation_records:
        listing_id = (record.extra or {}).get("listing_id")
        if isinstance(listing_id, str) and listing_id:
            records_by_listing.setdefault(listing_id, []).append(record)
    diagnosed_items = []
    for listing in listings:
        metrics = _listing_operation_metrics(listing)
        diagnostic = _listing_operation_diagnostic(metrics, listing)
        feedback = _latest_operation_feedback(records_by_listing.get(listing.id, []))
        if diagnostic["code"] == "monitor" and not feedback["record_id"]:
            continue
        diagnosed_items.append({
            "listing_id": listing.id,
            "title": listing.title,
            "stock": listing.stock,
            "views_30d": metrics["views_30d"],
            "orders_30d": metrics["orders_30d"],
            "conversion_rate_pct": metrics["conversion_rate_pct"],
            "diagnostic_code": diagnostic["code"],
            "diagnostic_title": diagnostic["title"],
            "diagnostic_detail": diagnostic["detail"],
            **feedback,
            "route": "/growth",
        })
    refs = unique_refs([
        source_ref("platform_listing", item.id, label=item.title, meta={"source_label": "平台 Listing", "route": "/growth"})
        for item in listings[:REFERENCE_LIMIT]
    ] + [
        source_ref("operation_record", item.id, label=item.name, meta={"source_label": "运营台账", "route": "/operations"})
        for item in operation_records[:REFERENCE_LIMIT]
    ])
    reviewed_action_count = sum(1 for item in operation_records if _is_reviewed_operation_record(item))
    pending_action_count = len(operation_records) - reviewed_action_count
    gaps = []
    if not listings:
        gaps.append("暂无在售 Listing，无法形成商品运营表现")
    if listings and not diagnosed_items:
        gaps.append("当前 Listing 未触发运营诊断，继续等待平台经营指标")
    return _summary_like_section(
        records=diagnosed_items or listings,
        refs=refs,
        evidence_window=f"近30天商品运营指标与运营台账复盘，生成于 {_iso(now)}",
        confidence_reason="商品运营表现来自在售 Listing 的 performance 字段和 Listing 优化类运营台账复盘，不用缺失指标生成强结论。",
        metrics={
            "listing_count": len(listings),
            "diagnosed_listing_count": len(diagnosed_items),
            "action_record_count": len(operation_records),
            "pending_action_count": pending_action_count,
            "reviewed_action_count": reviewed_action_count,
        },
        items=diagnosed_items[:8],
        gaps=gaps,
        actions=[
            _action("查看商品运营诊断", "/growth", "进入增长引擎按 Listing 查看指标、诊断和复盘结果。"),
            _action("进入运营台账", "/operations?record_type=listing_optimization", "处理 Listing 优化动作并填写复盘结果。"),
        ] if listings else [_action("进入商品与刊登", "/publish", "先生成平台 Listing 后再观察商品运营表现。")],
    )

def _competitor_section(competitors: list[CompetitorProduct], now: datetime) -> dict:
    changed = [item for item in competitors if _previous_price(item) not in (None, item.price)]
    return _section(
        competitors,
        "competitor_product",
        f"当前数据库最新竞品快照，生成于 {_iso(now)}",
        metrics={"tracked": len(competitors), "price_changes_detected": len(changed)},
        items=[{
            "id": item.id,
            "platform": item.platform,
            "name": item.name,
            "price": item.price,
            "previous_price": _previous_price(item),
            "last_updated": _iso(item.last_updated),
        } for item in competitors[:6]],
        gaps=[] if competitors else ["尚未跟踪真实竞品"],
    )

def _alerts_section(alerts: list[InventoryAlertLog], now: datetime) -> dict:
    return _section(
        alerts,
        "inventory_alert_log",
        f"当前未处理预警，生成于 {_iso(now)}",
        metrics={
            "open": len(alerts),
            "critical": sum(1 for item in alerts if item.severity == "critical"),
            "warning": sum(1 for item in alerts if item.severity == "warning"),
        },
        items=[{
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product_name,
            "current_stock": item.current_stock,
            "threshold": item.threshold,
            "severity": item.severity,
            "created_at": _iso(item.created_at),
        } for item in alerts[:6]],
        gaps=[],
        empty_status="ready",
    )

def _report_section(report: dict, anomalies: list[dict], orders: list[Order], now: datetime) -> dict:
    today = now.date()
    today_orders = [item for item in orders if item.ordered_at and item.ordered_at.date() == today]
    quality = report["data_quality"]
    gaps = []
    if not today_orders:
        gaps.append("今日没有真实订单，日报暂无经营样本")
    if quality["cost_status"] == "missing" and quality["missing_cost_items"] > 0:
        gaps.append(f"{quality['missing_cost_items']} 个订单商品缺采购成本")
    if quality["cost_status"] == "not_evaluated":
        gaps.append("当前筛选范围未执行订单成本完整性复核")
    return _section(
        today_orders,
        "order",
        f"今日订单与前7日均值比较，生成于 {_iso(now)}",
        metrics={
            "today_orders": report["summary"]["total_orders"],
            "anomaly_count": len(anomalies),
            "cost_status": quality["cost_status"],
        },
        items=anomalies[:6],
        gaps=gaps,
    )

def _suggestion_section(suggestions: list[AISuggestion], now: datetime) -> dict:
    return _section(
        suggestions,
        "ai_suggestion",
        f"当前未忽略建议，生成于 {_iso(now)}",
        metrics={
            "active": len(suggestions),
            "unread": sum(1 for item in suggestions if not item.is_read),
            "critical_unread": sum(1 for item in suggestions if item.severity == "critical" and not item.is_read),
        },
        items=[{
            "id": item.id,
            "title": item.title,
            "severity": item.severity,
            "confidence": item.confidence,
            "source_refs": item.source_refs or [],
            "evidence_window": item.evidence_window,
            "confidence_reason": item.confidence_reason,
        } for item in suggestions[:6]],
        gaps=[] if suggestions else ["当前没有可展示的 AI 运营建议"],
        empty_status="ready",
    )

def _summary_like_section(records, refs: list[dict], evidence_window: str, confidence_reason: str, metrics: dict,
                          items: list, gaps: list, empty_status: str = "data_required", actions: Optional[list[dict]] = None) -> dict:
    return {
        "status": "ready" if records else empty_status,
        "source_count": len(refs),
        **evidence_payload(
            source_refs=refs,
            evidence_window=evidence_window,
            confidence_reason=confidence_reason,
            data_gaps=gaps,
        ),
        "metrics": metrics,
        "items": items,
        "gaps": gaps,
        "actions": actions or [],
    }

def _section(
    records,
    source_type: str,
    evidence_window: str,
    metrics: dict,
    items: list,
    gaps: list,
    empty_status: str = "data_required",
    actions: Optional[list[dict]] = None,
) -> dict:
    source_label, route = SOURCE_META[source_type]
    refs = [source_ref(
        source_type,
        item.id,
        label=_record_label(item, source_label),
        meta={"source_label": source_label, "route": route},
    ) for item in records[:REFERENCE_LIMIT]]
    confidence_reason = (
        f"基于 {len(records)} 条 {source_type} 真实记录生成。"
        if records
        else "当前没有可用于该区块计算的真实记录。"
    )
    return {
        "status": "ready" if records else empty_status,
        "source_count": len(records),
        **evidence_payload(
            source_refs=refs,
            evidence_window=evidence_window,
            confidence_reason=confidence_reason,
            data_gaps=gaps,
        ),
        "metrics": metrics,
        "items": items,
        "gaps": gaps,
        "actions": actions or [],
    }

def _action(label: str, route: str, reason: str) -> dict:
    return {"label": label, "route": route, "reason": reason}

def _listing_operation_metrics(listing: PlatformListing) -> dict:
    performance = listing.performance or {}
    views = _metric_number(performance, "views_30d")
    orders = _metric_number(performance, "orders_30d")
    return {
        "views_30d": views,
        "orders_30d": orders,
        "conversion_rate_pct": round((orders / views) * 100, 2) if views and orders is not None else None,
    }

def _listing_operation_diagnostic(metrics: dict, listing: PlatformListing) -> dict:
    if metrics["views_30d"] and metrics["orders_30d"] == 0:
        return {
            "code": "traffic_no_order",
            "title": "有浏览无订单",
            "detail": "经营指挥台检测到 Listing 有浏览但无订单，应下钻复核标题、主图、价格和平台字段完整性。",
        }
    if metrics["conversion_rate_pct"] is not None and 0 < metrics["conversion_rate_pct"] < 1:
        return {
            "code": "low_conversion",
            "title": "转化率偏低",
            "detail": "转化率低于 1%，应复核价格、评价、详情页卖点和竞品差异。",
        }
    if listing.stock <= 5 and (metrics["orders_30d"] or 0) > 0:
        return {
            "code": "stock_risk",
            "title": "库存临界",
            "detail": "近30天已有订单且库存低，需复核补货和发货风险。",
        }
    return {"code": "monitor", "title": "持续观察", "detail": "当前商品运营指标未触发明确诊断。"}

def _latest_operation_feedback(records: list[OperationRecord]) -> dict:
    if not records:
        return {
            "record_id": None,
            "record_name": None,
            "review_result": None,
            "effect_summary": None,
            "pending_count": 0,
            "reviewed_count": 0,
        }
    reviewed = [item for item in records if _is_reviewed_operation_record(item)]
    latest = reviewed[0] if reviewed else records[0]
    metrics = latest.metrics or {}
    extra = latest.extra or {}
    return {
        "record_id": latest.id,
        "record_name": latest.name,
        "review_result": metrics.get("review_result") or latest.notes,
        "effect_summary": extra.get("effect_summary") or metrics.get("effect_summary"),
        "pending_count": sum(1 for item in records if not _is_reviewed_operation_record(item)),
        "reviewed_count": len(reviewed),
    }

def _is_reviewed_operation_record(record: OperationRecord) -> bool:
    metrics = record.metrics or {}
    extra = record.extra or {}
    return bool(
        record.completed_at
        or record.status in {"operation_completed", "completed", "done", "closed"}
        or metrics.get("review_result")
        or extra.get("effect_summary")
    )

def _metric_number(performance: dict, key: str):
    value = performance.get(key)
    return round(float(value), 2) if isinstance(value, (int, float)) else None

def _record_label(record, fallback: str) -> str:
    for field in ("order_number", "platform_order_id", "product_name", "name", "title", "entry_type", "sku"):
        value = getattr(record, field, None)
        if value:
            return str(value)
    return fallback

def _previous_price(item: CompetitorProduct):
    history = item.price_history if isinstance(item.price_history, list) else []
    prices = [entry.get("price") for entry in history if isinstance(entry, dict) and entry.get("price") is not None]
    return prices[-1] if prices else None

def _window(start: datetime, end: datetime) -> str:
    display_end = end - timedelta(microseconds=1)
    return f"{_iso(start)} 至 {_iso(display_end)}"

def _iso(value) -> str:
    return value.isoformat() if value else ""

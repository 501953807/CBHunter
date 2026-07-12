"""Center summaries for the V2 operating cockpit."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_suggestion import AISuggestion
from app.models.competitor_product import CompetitorProduct
from app.models.inventory_alert import InventoryAlertLog
from app.models.order import Order
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.sourcing_item import SourcingItem
from app.services.evidence_service import evidence_payload, source_ref, unique_refs


async def build_cockpit_center_summaries(
    db: AsyncSession,
    user_id: str,
    store_ids: list[str],
    *,
    orders: list[Order],
    listings: list[PlatformListing],
    alerts: list[InventoryAlertLog],
    competitors: list[CompetitorProduct],
    suggestions: list[AISuggestion],
    anomalies: list[dict],
    sections: dict,
    now: datetime,
) -> dict:
    accounts = await _load_accounts(db, store_ids)
    sourcing_items = await _load_sourcing_items(db, user_id)
    return {
        "store_matrix": _store_matrix_section(accounts, orders, listings, now),
        "risk_summary": _risk_summary_section(alerts, competitors, suggestions, anomalies, orders, sections, now),
        "flow_summary": _flow_summary_section(sourcing_items, orders, listings, suggestions, anomalies, sections, now),
    }


async def _load_accounts(db: AsyncSession, store_ids: list[str]) -> list[PlatformAccount]:
    if not store_ids:
        return []
    result = await db.execute(select(PlatformAccount).where(PlatformAccount.id.in_(store_ids)))
    return list(result.scalars().all())


async def _load_sourcing_items(db: AsyncSession, user_id: str) -> list[SourcingItem]:
    result = await db.execute(
        select(SourcingItem)
        .where(SourcingItem.user_id == user_id)
        .order_by(SourcingItem.updated_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


def _store_matrix_section(
    accounts: list[PlatformAccount],
    orders: list[Order],
    listings: list[PlatformListing],
    now: datetime,
) -> dict:
    items = []
    for account in accounts:
        account_orders = [item for item in orders if item.platform_account_id == account.id]
        account_listings = [item for item in listings if item.platform_account_id == account.id]
        settings = account.settings if isinstance(account.settings, dict) else {}
        items.append({
            "id": account.id,
            "platform": account.platform,
            "account_name": account.account_name,
            "market": settings.get("market") or "unknown",
            "status": "active" if account.is_active else "inactive",
            "order_count": len(account_orders),
            "active_listings": len(account_listings),
            "revenue_by_currency": _revenue_by_currency(account_orders),
            "last_sync_at": _iso(account.last_sync_at),
        })
    refs = [
        source_ref("platform_account", item.id, label=item.account_name, meta={"source_label": "平台店铺", "route": "/platforms"})
        for item in accounts
    ]
    gaps = [] if accounts else ["当前用户没有可访问平台店铺"]
    return _summary_section(
        records=accounts,
        refs=refs,
        evidence_window=f"当前平台店铺快照，生成于 {_iso(now)}",
        confidence_reason=f"基于 {len(accounts)} 个可访问平台店铺、订单和 Listing 聚合。",
        metrics={
            "store_count": len(accounts),
            "active_store_count": sum(1 for item in accounts if item.is_active),
            "platform_count": len({item.platform for item in accounts}),
            "order_count": sum(item["order_count"] for item in items),
            "active_listings": sum(item["active_listings"] for item in items),
        },
        items=items,
        gaps=gaps,
        actions=[] if accounts else [_action("配置平台店铺", "/platforms", "经营指挥台需要真实店铺后才能按平台/市场拆解。")],
    )


def _risk_summary_section(
    alerts: list[InventoryAlertLog],
    competitors: list[CompetitorProduct],
    suggestions: list[AISuggestion],
    anomalies: list[dict],
    orders: list[Order],
    sections: dict,
    now: datetime,
) -> dict:
    risks = []
    for item in alerts:
        risks.append(_risk_item(
            f"inventory:{item.id}", "inventory_alert_log", item.id, item.product_name,
            "critical" if item.severity == "critical" else "warning",
            f"当前库存 {item.current_stock}，阈值 {item.threshold}", "/inventory-alerts",
        ))
    for item in anomalies:
        risks.append(_risk_item(
            f"report:{item.get('metric')}", "report_anomaly", str(item.get("metric") or "report"),
            str(item.get("metric") or "报表异常"), "warning",
            f"实际 {item.get('actual')}，预期 {item.get('expected')}", "/reports",
        ))
    for item in suggestions:
        if item.severity == "critical":
            risks.append(_risk_item(
                f"ai:{item.id}", "ai_suggestion", item.id, item.title, "critical",
                item.confidence_reason or "AI 建议要求人工复核", "/ai-suggestions",
            ))
    for item in competitors:
        previous = _previous_price(item)
        if previous is not None and previous != item.price:
            risks.append(_risk_item(
                f"competitor:{item.id}", "competitor_product", item.id, item.name, "warning",
                f"价格 {previous} -> {item.price}", "/monitor",
            ))
    for item in orders:
        if item.status in ("pending", "processing") and _older_than_days(item.ordered_at, 3):
            risks.append(_risk_item(
                f"order:{item.id}", "order", item.id, item.order_number or item.platform_order_id,
                "warning", f"订单状态 {item.status} 超过 3 天", "/orders",
            ))
    refs = unique_refs([source_ref(item["object_type"], item["object_id"], label=item["title"], meta={"route": item["route"]}) for item in risks])
    gaps = [] if risks else _risk_gaps(sections)
    return _summary_section(
        records=risks,
        refs=refs,
        evidence_window=f"库存、报表、竞品、订单和 AI 建议风险窗口，生成于 {_iso(now)}",
        confidence_reason="风险摘要只展示可追溯对象，不自动关闭或替代人工处置。",
        metrics={
            "active_risk_count": len(risks),
            "critical": sum(1 for item in risks if item["severity"] == "critical"),
            "warning": sum(1 for item in risks if item["severity"] == "warning"),
        },
        items=risks[:8],
        gaps=gaps,
        empty_status="ready",
    )


def _flow_summary_section(
    sourcing_items: list[SourcingItem],
    orders: list[Order],
    listings: list[PlatformListing],
    suggestions: list[AISuggestion],
    anomalies: list[dict],
    sections: dict,
    now: datetime,
) -> dict:
    stages = [
        _stage("selection", "选品", "/scout", len(sourcing_items), _refs("sourcing_item", sourcing_items), "复核候选商品"),
        _stage("sourcing", "供应链/采购", "/scout/sources", len(sourcing_items), _refs("sourcing_item", sourcing_items), "补齐货源与成本"),
        _stage("content", "内容制作", "/content", 0, [], "制作标题、图片和视频"),
        _stage("listing", "平台刊登", "/publish", len(listings), _refs("platform_listing", listings), "处理 Listing 草稿和发布计划"),
        _stage("fulfillment", "订单履约", "/orders", len(orders), _refs("order", orders), "处理订单履约"),
        _stage("optimization", "运营优化", "/growth", len(suggestions) + len(anomalies), sections["ai_suggestions"]["source_refs"], "复核建议与报表异常"),
    ]
    blocked = sum(1 for item in stages if item["status"] == "blocked")
    refs = unique_refs([ref for item in stages for ref in item["source_refs"]])
    gaps = [item["gap"] for item in stages if item.get("gap")]
    return _summary_section(
        records=stages,
        refs=refs,
        evidence_window=f"六阶段业务链路快照，生成于 {_iso(now)}",
        confidence_reason="链路摘要由候选/货源、Listing、订单、报表异常和 AI 建议聚合，不脱离真实业务对象。",
        metrics={
            "stage_count": 6,
            "blocked": blocked,
            "ready": sum(1 for item in stages if item["status"] == "ready"),
            "data_required": sum(1 for item in stages if item["status"] == "data_required"),
        },
        items=stages,
        gaps=gaps,
        empty_status="ready",
    )


def _summary_section(records, refs: list[dict], evidence_window: str, confidence_reason: str, metrics: dict,
                     items: list, gaps: list, empty_status: str = "data_required", actions: list | None = None) -> dict:
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


def _stage(key: str, label: str, route: str, count: int, refs: list[dict], next_action: str) -> dict:
    gap = "" if count else f"{label}暂无可处理对象"
    return {
        "stage_key": key,
        "label": label,
        "route": route,
        "object_count": count,
        "status": "ready" if count else "data_required",
        "gap": gap,
        "next_action": next_action if count else f"进入{label}补齐数据",
        "source_refs": refs,
    }


def _risk_item(key: str, object_type: str, object_id: str, title: str, severity: str, detail: str, route: str) -> dict:
    return {
        "key": key,
        "object_type": object_type,
        "object_id": object_id,
        "title": title,
        "severity": severity,
        "detail": detail,
        "route": route,
    }


def _refs(ref_type: str, records: list) -> list[dict]:
    return [
        source_ref(ref_type, item.id, label=getattr(item, "product_name", None) or getattr(item, "title", None) or getattr(item, "platform_order_id", None), meta={"route": _route_for(ref_type)})
        for item in records[:20]
    ]


def _revenue_by_currency(orders: list[Order]) -> list[dict]:
    buckets: dict[str, dict] = {}
    for order in orders:
        bucket = buckets.setdefault(order.currency, {"currency": order.currency, "orders": 0, "revenue": 0.0})
        bucket["orders"] += 1
        bucket["revenue"] = round(bucket["revenue"] + order.total, 2)
    return list(buckets.values())


def _risk_gaps(sections: dict) -> list[str]:
    gaps = []
    for key in ("orders", "inventory", "competitors", "reports", "ai_suggestions"):
        gaps.extend(sections[key]["data_gaps"])
    return list(dict.fromkeys(gaps))


def _previous_price(item: CompetitorProduct):
    history = item.price_history if isinstance(item.price_history, list) else []
    prices = [entry.get("price") for entry in history if isinstance(entry, dict) and entry.get("price") is not None]
    return prices[-1] if prices else None


def _older_than_days(value, days: int) -> bool:
    if not value:
        return False
    current = datetime.now(timezone.utc)
    return current - value >= timedelta(days=days)


def _route_for(ref_type: str) -> str:
    return {
        "sourcing_item": "/scout/sources",
        "platform_listing": "/publish",
        "order": "/orders",
    }.get(ref_type, "/")


def _action(label: str, route: str, reason: str) -> dict:
    return {"label": label, "route": route, "reason": reason}


def _iso(value) -> str:
    return value.isoformat() if value else ""

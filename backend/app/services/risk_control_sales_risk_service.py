"""Sales-decline risk projection from real platform listing metrics."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing


async def get_listing_sales_decline_risks(db: AsyncSession, user_id: str) -> list[dict]:
    """Return Listing-level sales decline risks when real comparison metrics exist."""
    result = await db.execute(
        select(PlatformListing, PlatformAccount)
        .join(PlatformAccount, PlatformListing.platform_account_id == PlatformAccount.id)
        .where(and_(PlatformListing.user_id == user_id, PlatformListing.status == "active"))
    )
    risks: list[dict] = []
    for listing, account in result.all():
        performance = listing.performance if isinstance(listing.performance, dict) else {}
        decline = _decline_snapshot(performance)
        if not decline:
            continue
        account_settings = account.settings if isinstance(account.settings, dict) else {}
        deadline = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()
        risks.append({
            "id": f"business:sales-decline:{listing.id}",
            "type": "business",
            "type_label": "店铺经营风险",
            "title": f"{listing.title} 销售急剧下滑",
            "listing_id": listing.id,
            "product_id": listing.product_id,
            "platform": account.platform,
            "platform_account_id": account.id,
            "account_name": account.account_name,
            "market": account_settings.get("market"),
            "severity": "critical" if decline["drop_pct"] >= 70 else "warning",
            "status": "pending",
            "detail": (
                f"{decline['metric_label']}从前一连续30天 {_plain_amount(decline['previous'])} "
                f"降至近30天 {_plain_amount(decline['current'])}，下降 {decline['drop_pct']}%，"
                "请复核流量、价格、促销、库存、主图和平台处罚。"
            ),
            "route": f"/growth?listing_id={listing.id}",
            "evidence_window": "Listing performance 近30天与前一连续30天真实平台指标",
            "source_refs": [{
                "type": "platform_listing",
                "id": listing.id,
                "label": listing.title,
                "fields": ["performance.orders_30d", "performance.previous_orders_30d", "performance.sales_amount_30d", "performance.previous_sales_amount_30d"],
            }],
            "data_gaps": [],
            "estimated_impact": (
                f"{decline['metric_label']}下降 {decline['drop_pct']}%，可能意味着流量衰减、转化失效、"
                "价格竞争力下降、促销失效或平台规则影响。"
            ),
            "response_deadline_at": deadline,
            "remaining_time_label": "剩余3天",
            "sla_hours": 72,
        })
    return risks


def _decline_snapshot(performance: dict) -> dict | None:
    for current_key, previous_key, label in (
        ("orders_30d", "previous_orders_30d", "近30天订单"),
        ("sales_amount_30d", "previous_sales_amount_30d", "近30天销售额"),
    ):
        current = _number(performance.get(current_key))
        previous = _number(performance.get(previous_key))
        if current is None or previous is None or previous <= 0:
            continue
        drop_pct = round(((previous - current) / previous) * 100, 1)
        if previous >= 5 and drop_pct >= 50:
            return {"metric_label": label, "current": current, "previous": previous, "drop_pct": drop_pct}
    return None


def _number(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _plain_amount(value) -> str:
    number = float(value)
    if number.is_integer():
        return str(int(number))
    return f"{number:.2f}".rstrip("0").rstrip(".")

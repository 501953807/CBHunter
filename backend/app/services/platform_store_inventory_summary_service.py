"""Inventory alert summaries for platform/store product warehouse rows."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_alert import InventoryAlertLog, InventoryAlertRule
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product


async def build_inventory_alert_summaries(
    db: AsyncSession,
    user_id: str,
    rows: list[tuple[PlatformListing, PlatformAccount, Product]],
) -> dict[str, dict]:
    if not rows:
        return {}
    product_ids = list({product.id for _listing, _account, product in rows})
    rules = (await db.execute(
        select(InventoryAlertRule).where(
            InventoryAlertRule.user_id == user_id,
            InventoryAlertRule.product_id.in_(product_ids),
            InventoryAlertRule.enabled == True,
        )
    )).scalars().all()
    logs = (await db.execute(
        select(InventoryAlertLog).where(
            InventoryAlertLog.user_id == user_id,
            InventoryAlertLog.product_id.in_(product_ids),
            InventoryAlertLog.status == "open",
        )
    )).scalars().all()
    rules_by_product: dict[str, list[InventoryAlertRule]] = {}
    logs_by_product: dict[str, list[InventoryAlertLog]] = {}
    for rule in rules:
        rules_by_product.setdefault(rule.product_id, []).append(rule)
    for log in logs:
        logs_by_product.setdefault(log.product_id, []).append(log)
    return {
        listing.id: build_inventory_alert_summary(
            listing,
            product,
            rules_by_product.get(product.id, []),
            logs_by_product.get(product.id, []),
        )
        for listing, _account, product in rows
    }


def build_inventory_alert_summary(
    listing: PlatformListing,
    product: Product,
    rules: list[InventoryAlertRule],
    logs: list[InventoryAlertLog],
) -> dict:
    skus = listing_inventory_skus(listing, product)
    matched_rules = [rule for rule in rules if rule.sku in skus]
    matched_logs = [log for log in logs if log.sku in skus]
    current_stock = int(listing.stock or 0)
    safety_stock = max((rule.safety_stock for rule in matched_rules), default=None)
    below_safety_stock = safety_stock is not None and current_stock <= safety_stock
    if matched_logs:
        status = "open_alert"
        severity = highest_inventory_severity([log.severity for log in matched_logs])
        label = "有未处理库存预警"
    elif below_safety_stock:
        status = "below_safety_stock"
        severity = highest_inventory_severity([rule.severity for rule in matched_rules])
        label = "低于安全库存"
    elif current_stock <= 0:
        status = "stockout_rule_missing" if not matched_rules else "stockout"
        severity = "critical"
        label = "库存为0"
    elif matched_rules:
        status = "monitored"
        severity = "success"
        label = "已纳入库存预警"
    else:
        status = "rule_missing"
        severity = "info"
        label = "规则待配置"
    gaps = []
    if not matched_rules:
        gaps.append("当前商品SKU未配置库存预警规则")
    if current_stock <= 0 and not matched_logs:
        gaps.append("当前店铺Listing库存为0但暂无未处理告警记录")
    return {
        "status": status,
        "label": label,
        "severity": severity,
        "current_stock": current_stock,
        "safety_stock": safety_stock,
        "matched_rule_count": len(matched_rules),
        "open_alert_count": len(matched_logs),
        "below_safety_stock": below_safety_stock,
        "skus": sorted(skus),
        "data_gaps": gaps,
    }


def empty_inventory_alert_summary(listing: PlatformListing, product: Product) -> dict:
    return {
        "status": "rule_missing",
        "label": "规则待配置",
        "severity": "info",
        "current_stock": int(listing.stock or 0),
        "safety_stock": None,
        "matched_rule_count": 0,
        "open_alert_count": 0,
        "below_safety_stock": False,
        "skus": sorted(listing_inventory_skus(listing, product)),
        "data_gaps": ["当前商品SKU未配置库存预警规则"],
    }


def listing_inventory_skus(listing: PlatformListing, product: Product) -> set[str]:
    skus = {value for value in [product.sku] if value}
    variations = listing.variations if isinstance(listing.variations, list) else []
    for row in variations:
        if not isinstance(row, dict):
            continue
        for key in ("sku", "merchant_sku", "seller_sku", "platform_sku"):
            value = row.get(key)
            if value:
                skus.add(str(value))
    return skus


def highest_inventory_severity(severities: list[str]) -> str:
    order = {"critical": 3, "warning": 2, "info": 1, "success": 0}
    return max((severity or "info" for severity in severities), key=lambda item: order.get(item, 0), default="info")

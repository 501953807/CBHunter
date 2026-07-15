"""Inventory alert service — manage rules + scan for alerts."""

import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inventory_alert import InventoryAlertRule, InventoryAlertLog
from app.models.order import Order
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.services.store_access_service import list_accessible_store_ids_for_user_id
from app.models.product import Product
from app.services.order_service import build_fulfillment_exception_context

logger = logging.getLogger(__name__)


# ── Rules CRUD ──

async def list_rules(
    db: AsyncSession,
    user_id: str,
    product_id: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> list[InventoryAlertRule]:
    stmt = select(InventoryAlertRule).where(InventoryAlertRule.user_id == user_id)
    if product_id:
        stmt = stmt.where(InventoryAlertRule.product_id == product_id)
    if enabled is not None:
        stmt = stmt.where(InventoryAlertRule.enabled == enabled)
    stmt = stmt.order_by(desc(InventoryAlertRule.created_at))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_rule(
    db: AsyncSession,
    user_id: str,
    product_id: str,
    sku: str,
    product_name: str,
    safety_stock: int,
    severity: str,
) -> InventoryAlertRule:
    rule = InventoryAlertRule(
        user_id=user_id,
        product_id=product_id,
        sku=sku,
        product_name=product_name,
        safety_stock=safety_stock,
        severity=severity,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def update_rule(
    db: AsyncSession,
    rule_id: str,
    user_id: str,
    **kwargs,
) -> Optional[InventoryAlertRule]:
    stmt = select(InventoryAlertRule).where(
        and_(InventoryAlertRule.id == rule_id, InventoryAlertRule.user_id == user_id)
    )
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        return None
    for key, value in kwargs.items():
        if hasattr(rule, key):
            setattr(rule, key, value)
    rule.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(rule)
    return rule


async def delete_rule(db: AsyncSession, rule_id: str, user_id: str) -> bool:
    stmt = select(InventoryAlertRule).where(
        and_(InventoryAlertRule.id == rule_id, InventoryAlertRule.user_id == user_id)
    )
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        return False
    await db.delete(rule)
    await db.commit()
    return True


# ── Alert scanning ──

async def check_inventory(db: AsyncSession, user_id: str) -> dict:
    """Scan all rules for the user and create alert logs when stock < threshold."""
    rules = await list_rules(db, user_id, enabled=True)
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    new_alerts: list[InventoryAlertLog] = []
    skipped_no_confirmed_stock = 0

    for rule in rules:
        # Get current stock from PlatformListing
        listing_result = await db.execute(
            select(PlatformListing).where(
                and_(
                    PlatformListing.product_id == rule.product_id,
                    PlatformListing.platform_account_id.in_(store_ids),
                    PlatformListing.status == "active",
                )
            ).order_by(desc(PlatformListing.last_synced_at), desc(PlatformListing.updated_at))
        )
        listing = next(
            (
                candidate for candidate in listing_result.scalars().all()
                if (candidate.platform_data or {}).get("stock_status") != "missing"
            ),
            None,
        )
        if not listing:
            logger.info("Skip inventory rule %s: no active listing with confirmed stock", rule.id)
            skipped_no_confirmed_stock += 1
            continue
        current_stock = listing.stock

        if current_stock < rule.safety_stock:
            # Check if there's already an open alert for this rule
            existing = await db.execute(
                select(InventoryAlertLog).where(
                    and_(
                        InventoryAlertLog.rule_id == rule.id,
                        InventoryAlertLog.status == "open",
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue  # Already alerted

            log = InventoryAlertLog(
                rule_id=rule.id,
                user_id=user_id,
                product_id=rule.product_id,
                sku=rule.sku,
                product_name=rule.product_name,
                current_stock=current_stock,
                threshold=rule.safety_stock,
                severity=rule.severity,
                status="open",
            )
            db.add(log)
            new_alerts.append(log)

    if new_alerts:
        await db.commit()

    return {
        "alerts": new_alerts,
        "rules_checked": len(rules),
        "rules_skipped_no_confirmed_stock": skipped_no_confirmed_stock,
    }


# ── Alert log queries ──

async def list_alerts(
    db: AsyncSession,
    user_id: str,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[InventoryAlertLog], int]:
    stmt = select(InventoryAlertLog).where(InventoryAlertLog.user_id == user_id)
    count_stmt = select(func.count(InventoryAlertLog.id)).where(InventoryAlertLog.user_id == user_id)

    if status:
        stmt = stmt.where(InventoryAlertLog.status == status)
        count_stmt = count_stmt.where(InventoryAlertLog.status == status)
    if severity:
        stmt = stmt.where(InventoryAlertLog.severity == severity)
        count_stmt = count_stmt.where(InventoryAlertLog.severity == severity)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    stmt = stmt.order_by(desc(InventoryAlertLog.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def acknowledge_alert(db: AsyncSession, alert_id: str, user_id: str, username: str) -> Optional[InventoryAlertLog]:
    stmt = select(InventoryAlertLog).where(
        and_(InventoryAlertLog.id == alert_id, InventoryAlertLog.user_id == user_id)
    )
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()
    if not log or log.status != "open":
        return None
    log.status = "acknowledged"
    log.acknowledged_by = username
    log.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(log)
    return log


async def clear_alert(db: AsyncSession, alert_id: str, user_id: str) -> Optional[InventoryAlertLog]:
    stmt = select(InventoryAlertLog).where(
        and_(InventoryAlertLog.id == alert_id, InventoryAlertLog.user_id == user_id)
    )
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()
    if not log or log.status == "cleared":
        return None
    log.status = "cleared"
    log.cleared_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(log)
    return log


async def get_alert_stats(db: AsyncSession, user_id: str) -> dict:
    """Count by severity and status."""
    # Open alerts by severity
    result = await db.execute(
        select(InventoryAlertLog.severity, func.count(InventoryAlertLog.id))
        .where(and_(InventoryAlertLog.user_id == user_id, InventoryAlertLog.status == "open"))
        .group_by(InventoryAlertLog.severity)
    )
    by_severity = {row[0]: row[1] for row in result.all()}

    # Total open
    result = await db.execute(
        select(func.count(InventoryAlertLog.id))
        .where(and_(InventoryAlertLog.user_id == user_id, InventoryAlertLog.status == "open"))
    )
    total_open = result.scalar() or 0

    # Total rules
    result = await db.execute(
        select(func.count(InventoryAlertRule.id))
        .where(and_(InventoryAlertRule.user_id == user_id, InventoryAlertRule.enabled == True))
    )
    total_rules = result.scalar() or 0

    return {
        "total_rules": total_rules,
        "total_open": total_open,
        "critical": by_severity.get("critical", 0),
        "warning": by_severity.get("warning", 0),
        "info": by_severity.get("info", 0),
    }


async def get_inventory_risk_workbench(
    db: AsyncSession,
    user_id: str,
    now: datetime | None = None,
) -> dict:
    """Build a real-data inventory risk workbench snapshot.

    The function deliberately reports data gaps instead of inventing values:
    inventory capital requires confirmed listing stock and product cost_price;
    slow-moving risk requires platform performance views/orders; fulfillment
    overdue risk requires platform fulfillment deadlines.
    """
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    data_gaps: list[str] = []
    if not store_ids:
        data_gaps.append("platform_accounts.accessible_store")

    alerts, _total_alerts = await list_alerts(db, user_id, status="open", limit=50, offset=0)
    stockout_items = [
        {
            "alert_id": item.id,
            "product_id": item.product_id,
            "sku": item.sku,
            "product_name": item.product_name,
            "current_stock": item.current_stock,
            "threshold": item.threshold,
            "shortage": max((item.threshold or 0) - (item.current_stock or 0), 0),
            "severity": item.severity,
        }
        for item in alerts
    ]

    confirmed_listings: list[tuple[PlatformListing, Product, PlatformAccount]] = []
    if store_ids:
        result = await db.execute(
            select(PlatformListing, Product, PlatformAccount)
            .join(Product, PlatformListing.product_id == Product.id)
            .join(PlatformAccount, PlatformListing.platform_account_id == PlatformAccount.id)
            .where(
                and_(
                    PlatformListing.user_id == user_id,
                    PlatformListing.platform_account_id.in_(store_ids),
                    PlatformListing.status == "active",
                )
            )
        )
        for listing, product, account in result.all():
            platform_data = listing.platform_data if isinstance(listing.platform_data, dict) else {}
            if platform_data.get("stock_status") == "missing":
                data_gaps.append(f"platform_listing.confirmed_stock:{listing.id}")
                continue
            confirmed_listings.append((listing, product, account))

    capital_items: list[dict] = []
    capital_total = 0.0
    missing_cost_count = 0
    slow_moving_items: list[dict] = []
    missing_performance_count = 0
    for listing, product, account in confirmed_listings:
        stock = int(listing.stock or 0)
        account_settings = account.settings if isinstance(account.settings, dict) else {}
        if product.cost_price is None:
            missing_cost_count += 1
            data_gaps.append(f"product.cost_price:{product.sku}")
        else:
            amount = round(float(product.cost_price) * stock, 2)
            capital_total = round(capital_total + amount, 2)
            capital_items.append({
                "listing_id": listing.id,
                "product_id": product.id,
                "platform": account.platform,
                "platform_account_id": account.id,
                "account_name": account.account_name,
                "market": account_settings.get("market"),
                "sku": product.sku,
                "title": listing.title,
                "stock": stock,
                "unit_cost_rmb": float(product.cost_price),
                "capital_rmb": amount,
            })

        performance = listing.performance if isinstance(listing.performance, dict) else {}
        views_30d = performance.get("views_30d")
        orders_30d = performance.get("orders_30d")
        if views_30d is None or orders_30d is None:
            missing_performance_count += 1
            data_gaps.append(f"platform_listing.performance:{listing.id}")
        elif stock > 0 and float(views_30d) > 0 and int(orders_30d) == 0:
            unit_cost = float(product.cost_price) if product.cost_price is not None else None
            slow_moving_items.append({
                "listing_id": listing.id,
                "product_id": product.id,
                "platform": account.platform,
                "platform_account_id": account.id,
                "account_name": account.account_name,
                "market": account_settings.get("market"),
                "sku": product.sku,
                "title": listing.title,
                "stock": stock,
                "views_30d": views_30d,
                "orders_30d": orders_30d,
                "unit_cost_rmb": unit_cost,
                "capital_rmb": round(unit_cost * stock, 2) if unit_cost is not None else None,
                "route": f"/growth?listing_id={listing.id}",
            })

    fulfillment_items: list[dict] = []
    if store_ids:
        result = await db.execute(
            select(Order)
            .where(and_(Order.user_id == user_id, Order.platform_account_id.in_(store_ids)))
            .order_by(desc(Order.ordered_at))
            .limit(100)
        )
        for order in result.scalars().all():
            exception = build_fulfillment_exception_context(order, now=now)
            if exception.get("status") in {"shipping_overdue", "shipping_due_soon", "logistics_missing"}:
                fulfillment_items.append({
                    "order_id": order.id,
                    "order_number": order.order_number or order.platform_order_id,
                    "status": exception.get("status"),
                    "severity": exception.get("severity"),
                    "deadline_at": exception.get("deadline_at"),
                    "hours_to_deadline": exception.get("hours_to_deadline"),
                    "route": exception.get("route") or "/orders?exceptions=1",
                })
            for gap in exception.get("data_gaps", []):
                data_gaps.append(f"order.{gap}:{order.platform_order_id}")

    actions = [
        {
            "label": "处理缺货预警",
            "count": len(stockout_items),
            "route": "/products?tab=platform_store_products",
            "priority": "high" if stockout_items else "normal",
        },
        {
            "label": "复核库存资金占用",
            "count": len(capital_items),
            "route": "/products?tab=platform_store_products",
            "priority": "normal",
        },
        {
            "label": "复核滞销 Listing",
            "count": len(slow_moving_items),
            "route": "/growth",
            "priority": "high" if slow_moving_items else "normal",
        },
        {
            "label": "复核发货超期订单",
            "count": len(fulfillment_items),
            "route": "/orders?exceptions=1",
            "priority": "critical" if fulfillment_items else "normal",
        },
    ]

    return {
        "stockout": {
            "count": len(stockout_items),
            "items": stockout_items,
        },
        "capital": {
            "total_rmb": round(capital_total, 2),
            "items": capital_items[:20],
            "missing_cost_count": missing_cost_count,
        },
        "slow_moving": {
            "count": len(slow_moving_items),
            "items": slow_moving_items[:20],
            "missing_performance_count": missing_performance_count,
        },
        "fulfillment_overdue": {
            "count": len(fulfillment_items),
            "items": fulfillment_items[:20],
        },
        "actions": actions,
        "data_gaps": list(dict.fromkeys(data_gaps)),
    }

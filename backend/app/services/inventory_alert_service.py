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
from app.models.product_object_model import ProductSkuVariant
from app.models.sourcing_supplier import SourcingSupplier
from app.models.supply_product import SupplyProduct
from app.models.user import User
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
    missing_platform_stock_count = 0
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
                missing_platform_stock_count += 1
                data_gaps.append(f"platform_listing.confirmed_stock:{listing.id}")
                continue
            confirmed_listings.append((listing, product, account))

    capital_items: list[dict] = []
    capital_total = 0.0
    missing_cost_count = 0
    slow_moving_items: list[dict] = []
    missing_performance_count = 0
    v5_sku_listing_count = 0
    legacy_listing_stock_count = 0
    confirmed_stock_units = 0
    sku_variants_by_listing = await _sku_variants_by_listing(db, user_id, [listing.id for listing, _, _ in confirmed_listings])
    for listing, product, account in confirmed_listings:
        sku_variants = sku_variants_by_listing.get(listing.id, [])
        stock = sum(int(item.stock or 0) for item in sku_variants) if sku_variants else int(listing.stock or 0)
        sku_label = _sku_label(product.sku, sku_variants)
        sku_source = "v5_product_sku_variants" if sku_variants else "platform_listing.stock"
        confirmed_stock_units += stock
        if sku_variants:
            v5_sku_listing_count += 1
        else:
            legacy_listing_stock_count += 1
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
                "sku": sku_label,
                "sku_source": sku_source,
                "sku_count": len(sku_variants) or 1,
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
                "sku": sku_label,
                "sku_source": sku_source,
                "sku_count": len(sku_variants) or 1,
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
    supply_readiness = await _supply_readiness_summary(
        db,
        user_id,
        [product for _, product, _ in confirmed_listings],
    )
    data_gaps.extend(supply_readiness.pop("data_gaps", []))

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
        "stock_sources": {
            "confirmed_listing_count": len(confirmed_listings),
            "v5_sku_listing_count": v5_sku_listing_count,
            "legacy_listing_stock_count": legacy_listing_stock_count,
            "manual_rule_alert_count": len(stockout_items),
            "missing_platform_stock_count": missing_platform_stock_count,
            "confirmed_stock_units": confirmed_stock_units,
            "local_warehouse_count": supply_readiness["local_warehouse_count"],
            "warehouse_sync_ready_count": supply_readiness["warehouse_sync_ready_count"],
        },
        "supply_readiness": supply_readiness,
        "actions": actions,
        "data_gaps": list(dict.fromkeys(data_gaps)),
    }


async def _sku_variants_by_listing(
    db: AsyncSession,
    user_id: str,
    listing_ids: list[str],
) -> dict[str, list[ProductSkuVariant]]:
    if not listing_ids:
        return {}
    rows = (await db.execute(
        select(ProductSkuVariant).where(
            ProductSkuVariant.user_id == user_id,
            ProductSkuVariant.scope == "listing_override",
            ProductSkuVariant.platform_listing_id.in_(listing_ids),
            ProductSkuVariant.enabled.is_(True),
        )
    )).scalars().all()
    grouped: dict[str, list[ProductSkuVariant]] = {}
    for row in rows:
        if row.platform_listing_id:
            grouped.setdefault(row.platform_listing_id, []).append(row)
    return grouped


async def _supply_readiness_summary(
    db: AsyncSession,
    user_id: str,
    products: list[Product],
) -> dict:
    supply_products = (await db.execute(
        select(SupplyProduct).where(
            SupplyProduct.user_id == user_id,
            SupplyProduct.is_active.is_(True),
        )
    )).scalars().all()
    preferred_suppliers = (await db.execute(
        select(func.count(SourcingSupplier.id)).where(
            SourcingSupplier.user_id == user_id,
            SourcingSupplier.is_preferred.is_(True),
        )
    )).scalar_one()
    user = await db.get(User, user_id)
    warehouses = []
    if user and isinstance(user.settings, dict):
        warehouses = user.settings.get("warehouses") if isinstance(user.settings.get("warehouses"), list) else []
    warehouse_items = [item for item in warehouses if isinstance(item, dict)]
    warehouse_sync_ready_count = sum(
        1
        for item in warehouse_items
        if item.get("inventory_sync_mode") in {"api_sync", "platform_sync", "manual_with_sync", "manual_periodic"}
        or item.get("integration_status") in {"connected", "ready", "enabled"}
    )
    product_skus = {item.sku for item in products if item.sku}
    product_names = {item.name for item in products if item.name}
    matched_supply = [
        item
        for item in supply_products
        if (item.sku and item.sku in product_skus) or (item.name and item.name in product_names)
    ]
    data_gaps: list[str] = []
    if not supply_products:
        data_gaps.append("supply_products.active")
    if not warehouses:
        data_gaps.append("user.settings.warehouses")
    if not warehouse_sync_ready_count:
        data_gaps.append("warehouse.inventory_sync_mode")
    return {
        "active_supply_product_count": len(supply_products),
        "matched_listing_supply_count": len(matched_supply),
        "supply_with_price_count": sum(1 for item in supply_products if item.price_min is not None or item.price_max is not None),
        "supply_with_moq_count": sum(1 for item in supply_products if item.moq is not None),
        "preferred_supplier_count": int(preferred_suppliers or 0),
        "local_warehouse_count": len(warehouse_items),
        "warehouse_sync_ready_count": warehouse_sync_ready_count,
        "data_gaps": data_gaps,
    }


def _sku_label(product_sku: str, sku_variants: list[ProductSkuVariant]) -> str:
    if not sku_variants:
        return product_sku
    if len(sku_variants) == 1:
        return sku_variants[0].merchant_sku or product_sku
    return f"{product_sku} · {len(sku_variants)}个V5 SKU"

import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, exists

from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.analytics_snapshot import AnalyticsSnapshot
from app.services.store_access_service import list_accessible_store_ids_for_user_id
from app.services.evidence_service import evidence_payload, source_ref

logger = logging.getLogger(__name__)


async def get_dashboard_kpis(db: AsyncSession, user_id: str) -> dict:
    """Aggregate KPI data for the dashboard."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)

    # Total sales (30d)
    result = await db.execute(
        select(
            func.coalesce(func.sum(Order.total), 0),
            func.count(Order.id),
        ).where(
            Order.platform_account_id.in_(store_ids),
            Order.ordered_at >= thirty_days_ago,
            Order.status.notin_(["cancelled", "refunded"]),
        )
    )
    total_sales, order_count = result.one()

    # Average order value
    avg_order_value = total_sales / order_count if order_count > 0 else 0

    # Active listings (join through product)
    result = await db.execute(
        select(func.count(PlatformListing.id))
        .select_from(PlatformListing)
        .join(Product, PlatformListing.product_id == Product.id)
        .where(
            Product.user_id == user_id,
            PlatformListing.platform_account_id.in_(store_ids),
            PlatformListing.status == "active",
        )
    )
    active_listings = result.scalar() or 0

    # Active products
    result = await db.execute(
        select(func.count(Product.id)).where(
            Product.user_id == user_id,
            Product.status == "active",
        )
    )
    active_products = result.scalar() or 0

    # Previous period comparison (30d before)
    sixty_days_ago = now - timedelta(days=60)
    result = await db.execute(
        select(func.coalesce(func.sum(Order.total), 0))
        .where(
            Order.platform_account_id.in_(store_ids),
            Order.ordered_at >= sixty_days_ago,
            Order.ordered_at < thirty_days_ago,
            Order.status.notin_(["cancelled", "refunded"]),
        )
    )
    prev_sales = result.scalar() or 0
    sales_change = ((total_sales - prev_sales) / prev_sales * 100) if prev_sales > 0 else None

    data_gaps = []
    if order_count == 0:
        data_gaps.append("近30天没有可访问店铺的有效订单")
    if prev_sales <= 0:
        data_gaps.append("上一周期没有可比较销售额")
    return {
        "status": "ready" if order_count > 0 else "data_required",
        "total_sales": float(total_sales),
        "order_count": order_count,
        "avg_order_value": float(avg_order_value),
        "active_listings": active_listings,
        "active_products": active_products,
        "sales_change_pct": round(sales_change, 1) if sales_change is not None else None,
        "period": "30d",
        **evidence_payload(
            source_refs=[source_ref("order", field="ordered_at", label="近30天授权店铺订单")]
            if order_count > 0 else [],
            evidence_window="最近30天；环比使用此前30天",
            confidence_reason="销售额、订单数和客单价直接聚合授权店铺的非取消、非退款订单；商品与 Listing 数读取当前主数据。",
            data_gaps=data_gaps,
        ),
    }


async def get_sales_trend(db: AsyncSession, user_id: str, period: str = "7d") -> list[dict]:
    """Sales trend data grouped by day."""
    now = datetime.now(timezone.utc)
    days = {"7d": 7, "30d": 30, "90d": 90}
    num_days = days.get(period, 7)
    start_date = now - timedelta(days=num_days)
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)

    # We'll query orders grouped by date
    result = await db.execute(
        select(
            func.date(Order.ordered_at).label("day"),
            func.coalesce(func.sum(Order.total), 0).label("sales"),
            func.count(Order.id).label("orders"),
        ).where(
            Order.platform_account_id.in_(store_ids),
            Order.ordered_at >= start_date,
            Order.status.notin_(["cancelled", "refunded"]),
        ).group_by(func.date(Order.ordered_at))
        .order_by(func.date(Order.ordered_at))
    )

    rows = result.all()
    data_map = {row.day: {"sales": float(row.sales), "orders": row.orders} for row in rows}

    # Fill in missing days with zeros
    trend = []
    for i in range(num_days):
        d = (start_date + timedelta(days=i)).date()
        day_str = d.isoformat()
        entry = data_map.get(day_str, {"sales": 0.0, "orders": 0})
        trend.append({"date": day_str, "sales": entry["sales"], "orders": entry["orders"]})

    return trend


async def get_platform_comparison(db: AsyncSession, user_id: str) -> list[dict]:
    """Sales metrics grouped by platform."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)

    result = await db.execute(
        select(
            PlatformAccount.platform,
            func.coalesce(func.sum(Order.total), 0).label("sales"),
            func.count(Order.id).label("orders"),
        ).select_from(Order)
        .join(PlatformAccount, Order.platform_account_id == PlatformAccount.id)
        .where(
            Order.platform_account_id.in_(store_ids),
            Order.ordered_at >= thirty_days_ago,
            Order.status.notin_(["cancelled", "refunded"]),
        ).group_by(PlatformAccount.platform)
    )

    rows = result.all()
    return [
        {"platform": row.platform, "sales": float(row.sales), "orders": row.orders}
        for row in rows
    ]


async def get_product_performance(db: AsyncSession, user_id: str) -> dict:
    """Top performers and bottom performers by sales."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)

    # Top products by order items
    result = await db.execute(
        select(
            OrderItem.name,
            func.sum(OrderItem.total_price).label("revenue"),
            func.sum(OrderItem.quantity).label("units_sold"),
        ).select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            Order.platform_account_id.in_(store_ids),
            Order.ordered_at >= thirty_days_ago,
            Order.status.notin_(["cancelled", "refunded"]),
        ).group_by(OrderItem.name)
        .order_by(func.sum(OrderItem.total_price).desc())
        .limit(5)
    )
    top = [
        {"name": row.name, "revenue": float(row.revenue), "units": row.units_sold}
        for row in result.all()
    ]

    # Bottom performers: active listings with no linked order items.
    result = await db.execute(
        select(Product.name, PlatformListing.price)
        .select_from(PlatformListing)
        .join(Product, PlatformListing.product_id == Product.id)
        .where(
            Product.user_id == user_id,
            PlatformListing.platform_account_id.in_(store_ids),
            PlatformListing.status == "active",
            ~exists(select(OrderItem.id).where(OrderItem.product_id == Product.id)),
        ).limit(5)
    )
    bottom_products = result.all()
    bottom = [
        {
            "name": p.name,
            "price": float(p.price) if p.price is not None else None,
            "days_without_sale": None,
            "status": "no_sales_record",
        }
        for p in bottom_products
    ]

    return {"top_performers": top, "bottom_performers": bottom}


async def create_daily_snapshot(db: AsyncSession, user_id: str):
    """Create a daily analytics snapshot."""
    kpis = await get_dashboard_kpis(db, user_id)
    snapshot = AnalyticsSnapshot(
        user_id=user_id,
        snapshot_date=date.today(),
        period_type="daily",
        metrics=kpis,
    )
    db.add(snapshot)
    await db.commit()
    return snapshot

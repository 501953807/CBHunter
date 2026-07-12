"""Dashboard aggregation service — consolidates data from all modules."""
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trend_keyword import TrendKeyword
from app.models.trending_product import TrendingProduct
from app.models.product_discovery import ProductDiscovery
from app.models.sourcing_item import SourcingItem
from app.models.signal import Signal
from app.models.supply_product import SupplyProduct


async def get_dashboard_summary(db: AsyncSession, user_id: str) -> dict:
    """Aggregate dashboard data from all modules."""

    # Layer counts
    trend_count = await _count(
        db,
        select(TrendKeyword).where(
            or_(TrendKeyword.user_id == user_id, TrendKeyword.user_id.is_(None))
        ),
    )
    platform_count = await _count(db, select(TrendingProduct).where(TrendingProduct.user_id == user_id))
    supply_count = await _count(db, select(SupplyProduct).where(SupplyProduct.user_id == user_id))
    culture_count = await _count(db, select(Signal).where(Signal.user_id == user_id, Signal.layer == "culture"))

    # Sourcing pipeline
    pipeline = await _pipeline_summary(db, user_id)

    # Pending items
    pending_analysis = await _count(
        db, select(ProductDiscovery).where(
            ProductDiscovery.user_id == user_id,
            ProductDiscovery.status.in_(["discovered", "trend_analyzed"]),
        )
    )
    pending_decision = await _count(
        db, select(ProductDiscovery).where(
            ProductDiscovery.user_id == user_id,
            ProductDiscovery.decision.is_(None),
            ProductDiscovery.status != "discovered",
        )
    )

    # Recent activity (last 10 sourcing items)
    recent = await db.execute(
        select(SourcingItem).where(SourcingItem.user_id == user_id)
        .order_by(SourcingItem.updated_at.desc())
        .limit(10)
    )
    recent_items = []
    for item in recent.scalars().all():
        recent_items.append({
            "id": item.id,
            "product_name": item.product_name,
            "stage": item.pipeline_stage,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        })

    return {
        "layer_counts": {
            "trend": trend_count,
            "platform": platform_count,
            "supply": supply_count,
            "culture": culture_count,
        },
        "pipeline": pipeline,
        "pending": {
            "pending_analysis": pending_analysis,
            "pending_decision": pending_decision,
        },
        "recent_activity": recent_items,
    }


async def _count(db: AsyncSession, query) -> int:
    result = await db.execute(select(func.count()).select_from(query.subquery()))
    return result.scalar() or 0


async def _pipeline_summary(db: AsyncSession, user_id: str) -> dict:
    result = await db.execute(
        select(SourcingItem).where(SourcingItem.user_id == user_id)
    )
    items = list(result.scalars().all())
    summary = {
        "total": len(items),
        "discovery": 0, "jit_testing": 0, "jit_passed": 0,
        "price_review": 0, "vmi": 0, "active": 0, "discontinued": 0,
    }
    for item in items:
        stage = item.pipeline_stage
        if stage in summary:
            summary[stage] += 1
    return summary

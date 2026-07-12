"""Trending product source synchronization for approved platforms."""

import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trending_product import TrendingProduct

logger = logging.getLogger(__name__)

async def sync_trending_products(db: AsyncSession, user_id: str = "") -> dict:
    """Report approved-source readiness without inserting fallback products."""
    stats = {"shopee": 0, "temu": 0, "tiktok": 0, "total": 0, "errors": []}
    for platform, fetcher in (
        ("shopee", fetch_shopee_trending),
        ("temu", fetch_temu_trending),
        ("tiktok", fetch_tiktok_trending),
    ):
        stats[platform] = await fetcher(db, user_id)
    return stats


# ══════════════════════════════════════════
# Legacy functions — kept for backward compatibility
# These are no longer the primary sync path
# ══════════════════════════════════════════

async def fetch_shopee_trending(db: AsyncSession, user_id: str = "") -> int:
    """DEPRECATED: Shopee public API is unreliable due to anti-bot measures.
    Use browser extension capture instead."""
    logger.warning("Shopee auto-fetch disabled — use browser extension for Shopee products")
    return 0


async def fetch_temu_trending(db: AsyncSession, user_id: str = "") -> int:
    """DEPRECATED: TEMU has no public API.
    Use browser extension capture instead."""
    logger.warning("TEMU auto-fetch disabled — use browser extension for TEMU products")
    return 0


async def fetch_tiktok_trending(db: AsyncSession, user_id: str = "") -> int:
    """DEPRECATED: TikTok Shop has no public API.
    Use browser extension capture instead."""
    logger.warning("TikTok auto-fetch disabled — use browser extension for TikTok products")
    return 0


# ══════════════════════════════════════════
# CRUD helpers — shared by API layer
# ══════════════════════════════════════════

async def add_manual_product(
    db: AsyncSession,
    user_id: str,
    platform: str,
    name: str,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    sales_volume: Optional[int] = None,
    sales_growth_rate: Optional[float] = None,
    category_path: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> TrendingProduct:
    """Add a manually entered trending product."""
    now = datetime.now(timezone.utc)
    product = TrendingProduct(
        user_id=user_id,
        platform=platform,
        platform_product_id=f"manual_{now.timestamp()}",
        name=name,
        price_min=price_min,
        price_max=price_max,
        sales_volume=sales_volume,
        sales_growth_rate=sales_growth_rate,
        category_path=category_path,
        tags=tags or ["manual"],
        discovered_at=now,
        last_updated=now,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def delete_trending_product(db: AsyncSession, product_id: str, user_id: str = "") -> bool:
    """Delete a trending product by ID."""
    conditions = [TrendingProduct.id == product_id]
    if user_id:
        conditions.append(TrendingProduct.user_id == user_id)
    result = await db.execute(delete(TrendingProduct).where(*conditions))
    await db.commit()
    return result.rowcount > 0


async def get_trending_products_paginated(
    db: AsyncSession,
    user_id: str,
    platform: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[TrendingProduct], int]:
    """Get trending products with pagination."""
    query = select(TrendingProduct).where(
        TrendingProduct.user_id == user_id
    ).order_by(
        TrendingProduct.sales_volume.desc().nullslast()
    )
    if platform:
        query = query.where(TrendingProduct.platform == platform)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    products = list(result.scalars().all())

    return products, total

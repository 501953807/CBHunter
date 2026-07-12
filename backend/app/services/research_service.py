import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.market_research import MarketResearch
from app.models.trending_product import TrendingProduct
from app.models.competitor_product import CompetitorProduct

logger = logging.getLogger(__name__)


async def search_keywords(keyword: str, platform: str) -> dict:
    """Return keyword analysis only when a real data source is connected."""
    logger.warning("Keyword search skipped: no real keyword data source configured")
    return {
        "keyword": keyword,
        "platform": platform,
        "search_volume": None,
        "competition_level": None,
        "avg_price": None,
        "total_results": None,
        "related_keywords": [],
        "trend_data": [],
        "data_source": "not_configured",
    }


async def save_keyword(db: AsyncSession, user_id: str, keyword: str, platform: str, result: dict) -> MarketResearch:
    existing = await db.execute(
        select(MarketResearch).where(
            MarketResearch.user_id == user_id,
            MarketResearch.keyword == keyword,
            MarketResearch.platform == platform,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Keyword already saved")

    record = MarketResearch(
        user_id=user_id,
        keyword=keyword,
        platform=platform,
        search_volume=result.get("search_volume"),
        competition_level=result.get("competition_level"),
        avg_price=result.get("avg_price"),
        total_results=result.get("total_results"),
        related_keywords=result.get("related_keywords", []),
        trend_data=result.get("trend_data", []),
        analyzed_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_saved_keywords(db: AsyncSession, user_id: str) -> list[MarketResearch]:
    result = await db.execute(
        select(MarketResearch)
        .where(MarketResearch.user_id == user_id)
        .order_by(MarketResearch.analyzed_at.desc())
    )
    return list(result.scalars().all())


async def delete_saved_keyword(db: AsyncSession, record_id: str, user_id: str):
    await db.execute(
        delete(MarketResearch).where(
            MarketResearch.id == record_id,
            MarketResearch.user_id == user_id,
        )
    )
    await db.commit()


async def get_trending_products(db: AsyncSession, user_id: str, platform: Optional[str] = None) -> list[TrendingProduct]:
    query = select(TrendingProduct).where(TrendingProduct.user_id == user_id).order_by(TrendingProduct.sales_volume.desc())
    if platform:
        query = query.where(TrendingProduct.platform == platform)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_competitor(db: AsyncSession, user_id: str, data: dict) -> CompetitorProduct:
    comp = CompetitorProduct(
        user_id=user_id,
        platform=data.get("platform", ""),
        platform_product_id=data.get("platform_product_id"),
        name=data.get("name", ""),
        seller_name=data.get("seller_name"),
        price=data.get("price"),
        currency=data.get("currency"),
        market=data.get("market"),
        collection_method=data.get("collection_method"),
        confidence_level=data.get("confidence_level"),
        url=data.get("url"),
        last_updated=datetime.now(timezone.utc),
    )
    db.add(comp)
    await db.commit()
    await db.refresh(comp)
    return comp


async def list_competitors(db: AsyncSession, user_id: str) -> list[CompetitorProduct]:
    result = await db.execute(
        select(CompetitorProduct)
        .where(CompetitorProduct.user_id == user_id)
        .order_by(CompetitorProduct.last_updated.desc())
    )
    return list(result.scalars().all())


async def delete_competitor(db: AsyncSession, comp_id: str, user_id: str):
    await db.execute(
        delete(CompetitorProduct).where(
            CompetitorProduct.id == comp_id,
            CompetitorProduct.user_id == user_id,
        )
    )
    await db.commit()

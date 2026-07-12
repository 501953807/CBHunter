"""Persistent user-captured trend keywords."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.captured_keyword import CapturedKeyword


async def get_captured_keywords(
    db: AsyncSession,
    user_id: str,
    category: Optional[str] = None,
    market: Optional[str] = None,
) -> dict:
    """Get captured keywords grouped by category and market."""
    query = select(CapturedKeyword).where(CapturedKeyword.user_id == user_id)
    if category:
        query = query.where(CapturedKeyword.category == category)
    if market:
        query = query.where(CapturedKeyword.market == market)
    query = query.order_by(CapturedKeyword.category, CapturedKeyword.market, CapturedKeyword.search_volume.desc().nullslast())
    result = await db.execute(query)
    keywords = list(result.scalars().all())

    by_category: dict = {}
    market_kw_counts: dict = {}
    all_categories: set = set()

    for keyword in keywords:
        all_categories.add(keyword.category)
        by_category.setdefault(keyword.category, {})
        market_kw_counts.setdefault(keyword.category, {})
        by_category[keyword.category].setdefault(keyword.market, [])
        market_kw_counts[keyword.category].setdefault(keyword.market, 0)
        by_category[keyword.category][keyword.market].append(_serialize(keyword))
        market_kw_counts[keyword.category][keyword.market] += 1

    market_counts = {
        category_id: [
            {"market": market_id, "count": count}
            for market_id, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)
        ]
        for category_id, counts in market_kw_counts.items()
    }

    return {
        "categories": sorted(all_categories),
        "by_category": by_category,
        "market_counts": market_counts,
        "category_totals": {cat: sum(counts.values()) for cat, counts in market_kw_counts.items()},
        "total_keywords": len(keywords),
    }


async def add_captured_keyword(db: AsyncSession, data: dict):
    """Insert a captured keyword into the history table."""
    captured = CapturedKeyword(
        keyword=data.get("keyword", ""),
        market=data.get("market"),
        category=data.get("category"),
        search_volume=data.get("search_volume"),
        trend_direction=data.get("trend_direction"),
        growth_pct=data.get("growth_pct"),
        competition_level=data.get("competition_level"),
        trend_data=data.get("trend_data", []),
        source=data.get("source", "manual"),
        pinterest_volume=data.get("pinterest_volume"),
        pinterest_direction=data.get("pinterest_direction"),
        pinterest_growth=data.get("pinterest_growth"),
        pinterest_trend_data=data.get("pinterest_trend_data", []),
        has_pinterest_data=data.get("has_pinterest_data", False),
        cross_validation_score=data.get("cross_validation_score"),
        cross_validation_detail=data.get("cross_validation_detail"),
        user_id=data.get("user_id"),
    )
    db.add(captured)
    await db.commit()
    await db.refresh(captured)
    return captured


async def delete_captured_keyword(db: AsyncSession, keyword_id: str, user_id: str) -> bool:
    """Delete a captured keyword from history."""
    result = await db.execute(
        delete(CapturedKeyword).where(
            CapturedKeyword.id == keyword_id,
            CapturedKeyword.user_id == user_id,
        )
    )
    await db.commit()
    return result.rowcount > 0


def _serialize(keyword: CapturedKeyword) -> dict:
    return {
        "id": keyword.id,
        "keyword": keyword.keyword,
        "search_volume": keyword.search_volume,
        "trend_direction": keyword.trend_direction,
        "growth_pct": keyword.growth_pct,
        "trend_data": keyword.trend_data or [],
        "source": keyword.source or "manual",
        "pinterest_volume": keyword.pinterest_volume,
        "pinterest_direction": keyword.pinterest_direction,
        "pinterest_growth": keyword.pinterest_growth,
        "pinterest_trend_data": keyword.pinterest_trend_data or [],
        "has_pinterest_data": keyword.has_pinterest_data,
        "cross_validation_score": keyword.cross_validation_score,
        "cross_validation_detail": keyword.cross_validation_detail,
        "cross_validated_at": keyword.cross_validated_at.isoformat() if keyword.cross_validated_at else None,
    }

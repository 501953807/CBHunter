"""Trend keyword service.

Coordinates Google Trends and Pinterest collection, then exposes trend keyword
query and manual maintenance APIs. Collector and persistence details live in
smaller service modules to keep this orchestration layer readable.
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trend_keyword import TrendKeyword
from app.services import config_service
from app.services.seed_service import load_seeds as _load_category_seeds
from app.services.trend_collectors import discover_google_trends_sync, discover_pinterest
from app.services.trend_errors import shorten_error
from app.services.trend_persistence import cross_validate_staging, replace_trend_data

logger = logging.getLogger(__name__)

_sync_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="trend_sync")

async def _get_seeds_by_category(db: AsyncSession, category_id: str) -> list[dict]:
    """Load active DB-backed seeds for a category."""
    return await _load_category_seeds(db, category_id)


async def fetch_all_trends(db: AsyncSession) -> dict:
    """Full trend sync: discover, cross-validate, and atomically replace."""
    from app.services.system_config_service import get_pinterest_credentials

    staging: list[dict] = []
    errors: list[str] = []
    google_count = 0
    google_semaphore = asyncio.Semaphore(2)
    categories = await config_service.get_categories(db)
    markets = [
        {**market, "geo": market.get("geo", market["id"])}
        for market in await config_service.get_markets(db)
    ]

    async def _run_one_google(category_id: str, market: dict) -> None:
        nonlocal google_count
        seed_rows = await _get_seeds_by_category(db, category_id)
        market_id = market["id"]
        market_seeds = [
            seed for seed in seed_rows
            if seed.get("market") is None or seed.get("market") == market_id
        ]
        seed_keywords = [seed["keyword"] for seed in (market_seeds or seed_rows)]
        if not seed_keywords:
            logger.info(f"GT {category_id}/{market_id}: no seeds for this market, skipping")
            return

        async with google_semaphore:
            loop = asyncio.get_running_loop()
            future = loop.run_in_executor(
                _sync_executor,
                discover_google_trends_sync,
                category_id,
                market_id,
                seed_keywords,
                markets,
            )
            try:
                discovered = await asyncio.wait_for(future, timeout=45)
                google_count += len(discovered)
                staging.extend(discovered)
                if discovered:
                    logger.info(f"GT {category_id}/{market_id}: {len(discovered)} keywords")
            except asyncio.TimeoutError:
                err = f"GT {category_id}/{market_id}: 超时(45s)"
                logger.warning(err)
                errors.append(err)
            except ConnectionError:
                raise
            except Exception as e:
                err = f"GT {category_id}/{market_id}: {shorten_error(e)}"
                logger.warning(err)
                errors.append(err)

    google_tasks = [
        asyncio.create_task(_run_one_google(category["id"], market))
        for category in categories
        for market in markets
    ]
    if google_tasks:
        await asyncio.gather(*google_tasks, return_exceptions=True)

    if google_count == 0 and not errors:
        errors.append("Google Trends: 无关键词数据返回 (可能VPN未连通或接口限速)")
    elif google_count > 0:
        logger.info(f"GT discovered {google_count} keywords across all categories")

    pinterest_count = await _collect_pinterest(db, staging, errors, categories, markets)
    cross_count = cross_validate_staging(staging)

    if not staging:
        return await _empty_sync_response(db, errors)

    existing_count = await _trend_count(db)
    threshold = max(20, int(existing_count * 0.5)) if existing_count > 0 else 20
    if len(staging) < threshold:
        logger.warning(
            "Sync aborted: only %s keywords collected (threshold=%s, existing=%s).",
            len(staging),
            threshold,
            existing_count,
        )
        return {
            "google_trends": google_count,
            "pinterest": pinterest_count,
            "cross_validated": 0,
            "total": existing_count,
            "message": f"仅发现 {len(staging)} 个关键词 (需要 ≥{threshold}) — 保留现有 {existing_count} 条数据",
            "errors": errors,
        }

    await replace_trend_data(db, staging)
    logger.info(
        "Sync complete: %s GT + %s PT = %s keywords, %s CV",
        google_count,
        pinterest_count,
        len(staging),
        cross_count,
    )
    return {
        "google_trends": google_count,
        "pinterest": pinterest_count,
        "cross_validated": cross_count,
        "total": len(staging),
        "errors": errors,
    }


async def _collect_pinterest(
    db: AsyncSession,
    staging: list[dict],
    errors: list[str],
    categories: list[dict],
    markets: list[dict],
) -> int:
    """Collect optional Pinterest data and append to staging."""
    from app.services.system_config_service import get_pinterest_credentials

    try:
        email, password = await get_pinterest_credentials(db)
        if not email or not password:
            errors.append("Pinterest: 未配置账号 (前往 设置→接口密钥 配置)")
            return 0

        pinterest_results = await discover_pinterest(
            db,
            email,
            password,
            categories,
            markets,
            _load_category_seeds,
        )
        staging.extend(pinterest_results)
        if not pinterest_results:
            errors.append("Pinterest: 登录成功但未获取到趋势数据 (可能账号无数据或接口限速)")
        else:
            logger.info(f"PT discovered {len(pinterest_results)} keywords")
        return len(pinterest_results)
    except Exception as e:
        err = f"Pinterest: {shorten_error(e)}"
        logger.warning(err)
        errors.append(err)
        return 0


async def _empty_sync_response(db: AsyncSession, errors: list[str]) -> dict:
    existing_count = await _trend_count(db)
    if existing_count == 0:
        return {
            "google_trends": 0,
            "pinterest": 0,
            "cross_validated": 0,
            "total": 0,
            "message": "无法采集趋势数据",
            "errors": errors or ["请确认VPN已连接(Google Trends需要) 且 Pinterest账号已在设置中配置"],
        }
    return {
        "google_trends": 0,
        "pinterest": 0,
        "cross_validated": 0,
        "total": existing_count,
        "message": f"保留现有 {existing_count} 条数据 — 本次无新数据",
        "errors": errors,
    }


async def _trend_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(TrendKeyword.id)))
    return result.scalar() or 0


async def get_trends_by_category(
    db: AsyncSession,
    user_id: str,
    category: Optional[str] = None,
    market: Optional[str] = None,
) -> dict:
    """Get trend keywords grouped by category and market."""
    query = select(TrendKeyword).where(
        or_(TrendKeyword.user_id == user_id, TrendKeyword.user_id.is_(None))
    )
    if category:
        query = query.where(TrendKeyword.category == category)
    if market:
        query = query.where(TrendKeyword.market == market)
    query = query.order_by(
        TrendKeyword.category,
        TrendKeyword.market,
        TrendKeyword.search_volume.desc().nullslast(),
    )
    result = await db.execute(query)
    keywords = list(result.scalars().all())

    by_category: dict = {}
    market_kw_counts: dict = {}
    for keyword in keywords:
        by_category.setdefault(keyword.category, {})
        market_kw_counts.setdefault(keyword.category, {})
        by_category[keyword.category].setdefault(keyword.market, [])
        market_kw_counts[keyword.category].setdefault(keyword.market, 0)
        by_category[keyword.category][keyword.market].append(_serialize_trend(keyword))
        market_kw_counts[keyword.category][keyword.market] += 1

    sorted_by_category = {}
    for category_id, market_dict in by_category.items():
        sorted_markets = sorted(
            market_dict.items(),
            key=lambda item: market_kw_counts[category_id].get(item[0], 0),
            reverse=True,
        )
        sorted_by_category[category_id] = {market_id: kws for market_id, kws in sorted_markets}

    category_scores = {}
    for category_id, market_dict in by_category.items():
        all_keywords = [kw for market_keywords in market_dict.values() for kw in market_keywords]
        scores = [kw.get("search_volume", 0) or 0 for kw in all_keywords]
        category_scores[category_id] = sum(scores) / len(scores) if scores else 0

    sorted_categories = sorted(
        sorted_by_category.keys(),
        key=lambda category_id: category_scores.get(category_id, 0),
        reverse=True,
    )

    market_counts = {
        category_id: [
            {"market": market_id, "count": count}
            for market_id, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)
        ]
        for category_id, counts in market_kw_counts.items()
    }

    categories = await config_service.get_categories(db)
    markets = await config_service.get_markets(db)
    return {
        "categories": sorted_categories,
        "category_labels": {category["id"]: category for category in categories},
        "market_labels": {market["id"]: market for market in markets},
        "by_category": sorted_by_category,
        "market_counts": market_counts,
        "category_scores": category_scores,
        "category_totals": {cat: sum(counts.values()) for cat, counts in market_kw_counts.items()},
        "total_keywords": len(keywords),
        "last_fetch": keywords[0].last_fetched_at.isoformat() if keywords and keywords[0].last_fetched_at else None,
    }


async def get_last_fetch_time(db: AsyncSession) -> Optional[datetime]:
    """Get the most recent fetch time."""
    result = await db.execute(
        select(TrendKeyword.last_fetched_at)
        .where(TrendKeyword.last_fetched_at != None)
        .order_by(TrendKeyword.last_fetched_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def update_trend_data(
    db: AsyncSession,
    user_id: str,
    keyword_id: str,
    data: dict,
) -> Optional[TrendKeyword]:
    """Update user-recorded trend data."""
    result = await db.execute(
        select(TrendKeyword).where(
            TrendKeyword.id == keyword_id,
            TrendKeyword.user_id == user_id,
        )
    )
    keyword = result.scalar_one_or_none()
    if not keyword:
        return None

    for field in ("trend_direction", "growth_pct", "search_volume", "keyword", "source", "competition_level"):
        if field in data:
            setattr(keyword, field, data[field])
    keyword.last_fetched_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(keyword)
    return keyword


async def add_trend_keyword(
    db: AsyncSession, user_id: str, keyword: str, market: str, category: str
) -> TrendKeyword:
    """Manually add a keyword to track."""
    result = await db.execute(
        select(TrendKeyword).where(
            TrendKeyword.user_id == user_id,
            TrendKeyword.keyword == keyword,
            TrendKeyword.market == market,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    trend_keyword = TrendKeyword(
        user_id=user_id,
        keyword=keyword,
        market=market,
        category=category,
        source="manual",
    )
    db.add(trend_keyword)
    await db.commit()
    await db.refresh(trend_keyword)
    return trend_keyword


async def delete_trend_keyword(db: AsyncSession, user_id: str, keyword_id: str) -> bool:
    """Delete a trend keyword."""
    result = await db.execute(
        delete(TrendKeyword).where(
            TrendKeyword.id == keyword_id,
            TrendKeyword.user_id == user_id,
        )
    )
    await db.commit()
    return result.rowcount > 0


def _serialize_trend(keyword: TrendKeyword) -> dict:
    trend_data = keyword.trend_data or []
    trend_index = round(sum(trend_data) / len(trend_data), 1) if trend_data else None
    return {
        "id": keyword.id,
        "keyword": keyword.keyword,
        "search_volume": keyword.search_volume,
        "trend_direction": keyword.trend_direction,
        "growth_pct": keyword.growth_pct,
        "trend_data": trend_data,
        "trend_index": trend_index,
        "last_fetched_at": keyword.last_fetched_at.isoformat() if keyword.last_fetched_at else None,
        "source": keyword.source or "google_trends",
        "pinterest_volume": keyword.pinterest_volume,
        "pinterest_direction": keyword.pinterest_direction,
        "pinterest_growth": keyword.pinterest_growth,
        "pinterest_trend_data": keyword.pinterest_trend_data or [],
        "has_pinterest_data": keyword.has_pinterest_data,
        "cross_validation_score": keyword.cross_validation_score,
        "cross_validation_detail": keyword.cross_validation_detail,
        "cross_validated_at": keyword.cross_validated_at.isoformat() if keyword.cross_validated_at else None,
    }

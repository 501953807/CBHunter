"""External collectors used by trend_service."""

import asyncio
import logging
import random
import time
from datetime import datetime, timezone
from typing import Awaitable, Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.trend_errors import shorten_error

logger = logging.getLogger(__name__)

MAX_RISING_PER_SEED = 5

def discover_google_trends_sync(
    category: str,
    market_id: str,
    seeds: list[str],
    markets: list[dict],
) -> list[dict]:
    """Discover trending keywords for a category and market."""
    from pytrends.request import TrendReq
    import os

    market_config = next((m for m in markets if m["id"] == market_id), None)
    if not market_config or not market_config.get("locale"):
        raise ValueError(f"市场 {market_id} 缺少趋势采集 locale 配置")
    geo = market_config.get("geo") or market_id
    proxy_url = None
    for var in ("https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY", "all_proxy", "ALL_PROXY"):
        val = os.environ.get(var)
        if val:
            proxy_url = val
            break

    proxies = {"https": proxy_url, "http": proxy_url} if proxy_url else None
    locale = market_config["locale"]
    try:
        kwargs = {
            "hl": locale,
            "tz": 480,
            "timeout": (15, 30),
            "requests_args": {
                "headers": {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                }
            },
        }
        if proxies:
            kwargs["proxies"] = proxies
        pytrends = TrendReq(**kwargs)
    except Exception as e:
        raise ConnectionError(f"Google Trends 连接失败: {shorten_error(e)}") from e

    results: list[dict] = []
    seen_keys: set[str] = set()
    now = datetime.now(timezone.utc)
    logger.info(f"GT {category}/{market_id}: scanning {len(seeds)} seeds (geo={geo})")

    def _entry(keyword: str, volume, direction, growth, trend_data, source) -> dict:
        return {
            "keyword": keyword,
            "market": market_id,
            "category": category,
            "source": source,
            "search_volume": volume,
            "trend_direction": direction,
            "growth_pct": growth,
            "trend_data": trend_data if isinstance(trend_data, list) else [],
            "last_fetched_at": now,
            "pinterest_volume": None,
            "pinterest_direction": None,
            "pinterest_growth": None,
            "pinterest_trend_data": [],
            "has_pinterest_data": False,
            "cross_validation_score": None,
            "cross_validation_detail": None,
            "cross_validated_at": None,
        }

    for seed in seeds:
        key = f"{seed.lower().strip()}|{market_id}"
        if key in seen_keys:
            continue

        try:
            time.sleep(random.uniform(2, 4))
            pytrends.build_payload([seed], cat=0, timeframe="today 1-m", geo=geo, gprop="")

            interest = pytrends.interest_over_time()
            values: list[float] = []
            direction = "stable"
            growth = 0
            avg_index = 0

            if not interest.empty and seed in interest.columns:
                vals = interest[seed].dropna().tolist()
                values = vals
                avg_index = sum(vals) / len(vals) if vals else 0

                if len(vals) >= 4:
                    half = len(vals) // 2
                    first_half = sum(vals[:half]) / half
                    second_half = sum(vals[half:]) / (len(vals) - half)
                    if second_half > first_half * 1.15:
                        direction = "rising"
                        growth = ((second_half - first_half) / first_half) * 100 if first_half else 0
                    elif second_half < first_half * 0.85:
                        direction = "falling"
                        growth = -((first_half - second_half) / first_half) * 100 if first_half else 0

            if avg_index > 0:
                seen_keys.add(key)
                results.append(_entry(seed, None, direction, round(growth, 1) if growth else None, values, "google_trends"))

            try:
                time.sleep(1)
                related = pytrends.related_queries()
                if related and "rising" in related and related["rising"] is not None:
                    collected = 0
                    for _, row in related["rising"].iterrows():
                        if collected >= MAX_RISING_PER_SEED:
                            break
                        query = str(row["query"]).strip()
                        rise_val = row.get("value")
                        related_key = f"{query.lower().strip()}|{market_id}"

                        if related_key in seen_keys or len(query) < 3:
                            continue
                        query_norm = query.lower().strip()
                        if any(query_norm == s.lower().strip() or query_norm in s.lower() or s.lower() in query_norm for s in seeds):
                            continue

                        seen_keys.add(related_key)
                        growth_pct = int(rise_val) if isinstance(rise_val, (int, float)) else None
                        results.append(_entry(query, None, "rising", growth_pct, [], "google_trends"))
                        collected += 1
            except Exception as e:
                logger.debug(f"related_queries '{seed}' ({market_id}): {e}")

        except Exception as e:
            logger.debug(f"seed '{seed}' ({market_id}) failed: {e}")

    return results


async def discover_pinterest(
    db: AsyncSession,
    email: str,
    password: str,
    categories: list[dict],
    markets: list[dict],
    load_category_seeds: Callable[[AsyncSession, str], Awaitable[list[dict]]],
) -> list[dict]:
    """Discover trending terms from Pinterest Trends API."""
    from app.integrations.pinterest.fetcher import fetch_keyword_metrics
    from app.integrations.pinterest.auth import get_cached_cookies, clear_cached_cookies, test_cookies

    cookie_str = await get_cached_cookies(db, email, password)
    if not cookie_str:
        logger.warning("Pinterest login failed — check credentials in 设置→接口密钥")
        return []

    valid = await test_cookies(cookie_str, keyword="dress")
    if not valid:
        logger.info("Pinterest cookies expired — clearing cache and re-logging in")
        await clear_cached_cookies(db)
        cookie_str = await get_cached_cookies(db, email, password)
        if not cookie_str:
            return []

    results: list[dict] = []
    seen: set[str] = set()
    now = datetime.now(timezone.utc)
    semaphore = asyncio.Semaphore(3)

    async def _fetch_one_seed(seed: str, market_id: str, category_id: str) -> int:
        async with semaphore:
            try:
                data = await fetch_keyword_metrics([seed], market_id, days=90, cookie_str=cookie_str)
                added = 0
                for item in data:
                    term = item.get("term", "")
                    if not term:
                        continue
                    key = f"{term.lower().strip()}|{market_id}"
                    if key in seen:
                        continue
                    seen.add(key)

                    counts = item.get("counts", [])
                    vals = [c.get("normalizedCount", 0) for c in counts]
                    growth = _pinterest_growth_rate(item)
                    direction = "stable"
                    if growth is not None:
                        direction = "rising" if growth > 5 else ("falling" if growth < -5 else "stable")

                    results.append({
                        "keyword": term,
                        "market": market_id,
                        "category": category_id,
                        "source": "pinterest",
                        "search_volume": None,
                        "trend_direction": direction,
                        "growth_pct": round(growth, 1) if growth else None,
                        "trend_data": vals,
                        "last_fetched_at": now,
                        "pinterest_volume": None,
                        "pinterest_direction": direction,
                        "pinterest_growth": round(growth, 1) if growth else None,
                        "pinterest_trend_data": vals,
                        "has_pinterest_data": True,
                        "cross_validation_score": None,
                        "cross_validation_detail": None,
                        "cross_validated_at": None,
                    })
                    added += 1
                if added:
                    logger.info(f"PT {category_id}/{market_id}/{seed}: {added} keywords")
                return added
            except Exception as e:
                logger.debug(f"PT seed '{seed}' ({market_id}): {e}")
                return 0

    tasks = []
    for category in categories:
        category_id = category["id"]
        seed_rows = await load_category_seeds(db, category_id)
        for seed in [s["keyword"] for s in seed_rows[:2]]:
            for market in markets:
                tasks.append(asyncio.create_task(_fetch_one_seed(seed, market["id"], category_id)))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

    return results


def _pinterest_growth_rate(ptrend: dict) -> Optional[float]:
    growth_rates = ptrend.get("growth_rates", {}) or {}
    for key in ("mom_change", "wow_change", "yoy_change"):
        value = growth_rates.get(key)
        if value is not None:
            return float(value)
    return None

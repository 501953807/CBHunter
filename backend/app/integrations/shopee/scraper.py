"""Shopee search scraper — keyword competition analysis.

Uses Shopee's public search API (JSON endpoint, no auth required).
Rate-limited with random delays between requests.
"""

import asyncio
import logging
import random
import time
from urllib.parse import quote
import httpx

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

DELAY_MIN, DELAY_MAX = 2.0, 5.0
_last_request_time: float = 0.0


async def _rate_limit():
    global _last_request_time
    now = time.time()
    elapsed = now - _last_request_time
    if elapsed < DELAY_MIN:
        wait = DELAY_MIN - elapsed + random.uniform(0, DELAY_MAX - DELAY_MIN)
        await asyncio.sleep(wait)
    _last_request_time = time.time()


async def search_keyword(
    keyword: str, market: str, market_config: dict, limit: int = 60
) -> dict:
    """Search Shopee for a keyword, return raw results."""
    if not market:
        return {"total_count": 0, "items": [], "keyword": keyword, "market": market, "error": "market_required"}
    domain = (market_config.get("domains") or {}).get("shopee")
    if not domain:
        return {"total_count": 0, "items": [], "keyword": keyword, "market": market, "error": "unsupported_market"}
    await _rate_limit()

    url = (
        f"https://{domain}/api/v4/search/search_items"
        f"?by=relevancy&keyword={quote(keyword)}&limit={min(limit, 60)}"
        f"&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2"
    )

    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": f"https://{domain}/",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers, follow_redirects=True)

        if resp.status_code == 429:
            return {"total_count": 0, "items": [], "keyword": keyword, "market": market, "error": "rate_limited"}
        if resp.status_code != 200:
            return {"total_count": 0, "items": [], "keyword": keyword, "market": market, "error": f"http_{resp.status_code}"}

        data = resp.json()
        if data.get("error"):
            return {"total_count": 0, "items": [], "keyword": keyword, "market": market, "error": "api_error"}

        items = data.get("items") or []
        total = data.get("total_count", len(items))
        parsed = []

        for item in items:
            b = item.get("item_basic", {}) or {}
            raw_price = b.get("price")
            parsed.append({
                "item_id": b.get("itemid"),
                "shop_id": b.get("shopid"),
                "name": b.get("name", ""),
                "price": raw_price / 100000 if raw_price is not None else None,
                "sold": b.get("historical_sold"),
                "rating": (b.get("item_rating", {}) or {}).get("rating_star"),
                "rating_count": sum((b.get("item_rating", {}) or {}).get("rating_count", [])),
                "shop_location": b.get("shop_location", ""),
                "image": b.get("image", ""),
            })

        return {"total_count": total, "items": parsed, "keyword": keyword, "market": market, "error": None}

    except Exception as e:
        return {"total_count": 0, "items": [], "keyword": keyword, "market": market, "error": str(e)[:100]}


async def analyze_competition(keyword: str, market: str, market_config: dict) -> dict:
    """Analyze keyword competition — returns blue ocean score."""
    r = await search_keyword(keyword, market, market_config)

    if r["error"]:
        return {
            "keyword": keyword,
            "market": market,
            "error": r["error"],
            "competition_score": None,
            "total_results": None,
        }

    items = r["items"]
    if not items:
        return {
            "keyword": keyword,
            "market": market,
            "competition_score": None,
            "total_results": r["total_count"],
            "avg_price": None,
            "avg_sold": None,
            "avg_rating": None,
            "top_shop_share": None,
            "is_blue_ocean": False,
            "recommendation": "当前查询未返回商品，可能是零结果、接口限制或关键词不适配，需人工复核。",
            "error": None,
            "data_status": "insufficient",
        }

    total = r["total_count"]
    prices = [i["price"] for i in items if i["price"] is not None and i["price"] > 0]
    solds = [i["sold"] for i in items if i["sold"] is not None and i["sold"] > 0]
    ratings = [i["rating"] for i in items if i["rating"] is not None and i["rating"] > 0]

    avg_price = sum(prices) / len(prices) if prices else None
    avg_sold = sum(solds) / len(solds) if solds else None
    avg_rating = sum(ratings) / len(ratings) if ratings else None

    shop_counts: dict[int, int] = {}
    for item in items:
        sid = item.get("shop_id") or 0
        shop_counts[sid] = shop_counts.get(sid, 0) + 1
    top_shops = sorted(shop_counts.values(), reverse=True)[:5]
    top_share = sum(top_shops) / len(items) if items else 0

    total_score = max(0, 100 - min(total, 5000) / 50)
    share_score = max(0, 100 - top_share * 100)
    score_parts = [(total_score, 0.4), (share_score, 0.3)]
    if avg_sold is not None:
        score_parts.append((max(0, 100 - min(avg_sold, 5000) / 50), 0.3))
    competition_score = round(
        sum(score * weight for score, weight in score_parts)
        / sum(weight for _, weight in score_parts)
    )
    is_blue = competition_score >= 65

    return {
        "keyword": keyword, "market": market, "competition_score": competition_score,
        "total_results": total, "avg_price": round(avg_price, 2) if avg_price is not None else None,
        "avg_sold": round(avg_sold, 1) if avg_sold is not None else None,
        "avg_rating": round(avg_rating, 2) if avg_rating is not None else None,
        "top_shop_share": round(top_share, 2), "top_products": items[:10],
        "is_blue_ocean": is_blue,
        "recommendation": (
            f"低竞争信号(评分{competition_score})：共{total}个搜索结果，仍需核验利润和供货"
            if is_blue else
            f"中等竞争信号(评分{competition_score})：共{total}个搜索结果，需继续核验"
            if competition_score >= 40 else
            f"高竞争信号(评分{competition_score})：共{total}个搜索结果"
        ),
        "error": None, "data_status": "ready",
    }


async def batch_analyze(
    keywords: list[dict], market_configs: dict[str, dict], concurrency: int = 3
) -> list[dict]:
    """Batch analyze multiple keywords."""
    sem = asyncio.Semaphore(concurrency)
    async def _one(kw):
        async with sem:
            market = kw.get("market")
            return await analyze_competition(
                kw["keyword"], market, market_configs.get((market or "").upper(), {})
            )
    return await asyncio.gather(*[_one(k) for k in keywords])

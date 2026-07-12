"""1688 hot word collector — fetches trending search terms from 1688.com.

Data sources:
1. 1688 search suggestion API: https://suggest.1688.com/sug?q={query}&area=selling
   Returns related search terms + popularity indicators.
2. 1688 homepage hot search section (requires HTML parsing).

The hot words are then cross-validated against Shopee search data to
identify cross-border opportunities: 1688 surge + Shopee low competition = signal.
"""

import logging
from typing import Optional
from urllib.parse import quote
import httpx

logger = logging.getLogger(__name__)

# 1688 search suggest API
SUGGEST_URL = "https://suggest.1688.com/sug"
# 1688 homepage for hot searches
HOMEPAGE_URL = "https://www.1688.com/"

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

async def get_suggestions(query: str) -> list[dict]:
    """Get 1688 search suggestions for a keyword.

    Returns a list containing keyword and optional popularity fields.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                SUGGEST_URL,
                params={"q": query, "area": "selling"},
                headers={
                    "User-Agent": USER_AGENTS[0],
                    "Accept": "application/json",
                    "Referer": "https://www.1688.com/",
                },
            )
        if resp.status_code != 200:
            logger.warning(f"1688 suggest returned {resp.status_code}")
            return []

        data = resp.json()
        suggestions = []

        # 1688 suggest API returns {"result": [{"keyword": "...", ...}, ...]}
        result = data.get("result", []) if isinstance(data, dict) else []
        for item in result:
            if isinstance(item, dict) and item.get("keyword"):
                suggestions.append({
                    "keyword": item["keyword"],
                    "popularity": item.get("count") or item.get("popularity"),
                })

        return suggestions

    except Exception as e:
        logger.warning(f"1688 suggest error for '{query}': {e}")
        return []


async def discover_hot_keywords(categories: list[dict], max_depth: int = 3) -> list[dict]:
    """Crawl 1688 suggestions to discover trending keywords.

    Starts from category seed keywords, recursively fetches related suggestions.

    Returns list of {"keyword": str, "source_category": str, "cross_border_category": str}
    """
    seen: set[str] = set()
    results: list[dict] = []
    queue: list[tuple[str, str]] = _category_seed_queue(categories)

    for depth in range(max_depth):
        next_queue: list[tuple[str, str]] = []
        for keyword, seed_cat in queue:
            if keyword in seen:
                continue
            seen.add(keyword)

            suggestions = await get_suggestions(keyword)
            for s in suggestions:
                kw = s["keyword"]
                if kw not in seen:
                    results.append({
                        "keyword": kw,
                        "source_category": seed_cat,
                        "cross_border_category": seed_cat,
                        "popularity": s.get("popularity"),
                    })
                    if depth < max_depth - 1:
                        next_queue.append((kw, seed_cat))

        queue = next_queue

    # Deduplicate by keyword, keep highest popularity
    by_keyword: dict[str, dict] = {}
    for r in results:
        kw = r["keyword"]
        if kw not in by_keyword or (r.get("popularity") or 0) > (by_keyword[kw].get("popularity") or 0):
            by_keyword[kw] = r

    return sorted(by_keyword.values(), key=lambda x: x.get("popularity") or 0, reverse=True)


def _category_seed_queue(categories: list[dict]) -> list[tuple[str, str]]:
    """Build 1688 seed queue from the unified category dictionary."""
    queue: list[tuple[str, str]] = []
    for category in categories:
        seen_terms: set[str] = set()
        terms = [category["label"], *category.get("keywords", [])]
        for term in terms:
            cleaned = str(term).strip()
            if not cleaned or cleaned in seen_terms:
                continue
            seen_terms.add(cleaned)
            queue.append((cleaned, category["id"]))
    return queue


async def get_trending_from_homepage() -> list[dict]:
    """Scrape 1688 homepage hot search section (HTML parsing fallback)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                HOMEPAGE_URL,
                headers={"User-Agent": USER_AGENTS[0]},
            )
        if resp.status_code != 200:
            return []

        html = resp.text
        results = []

        # 1688 homepage often embeds hot keywords in specific divs or JSON
        # Simple extraction: look for common patterns
        import re
        # Pattern: data-keyword="xxx" or title="xxx" in hot search sections
        hot_matches = re.findall(r'data-keyword="([^"]+)"', html)
        title_matches = re.findall(r'title="([^"]+)"', html)

        seen: set[str] = set()
        for kw in hot_matches + title_matches:
            kw_clean = kw.strip()
            if len(kw_clean) >= 2 and len(kw_clean) <= 30 and kw_clean not in seen:
                seen.add(kw_clean)
                results.append({"keyword": kw_clean, "source": "homepage_hot", "popularity": None})

        return results[:50]

    except Exception as e:
        logger.warning(f"1688 homepage scrape error: {e}")
        return []

"""Seed discovery — scan Google Trends for trending keywords by market.

Since pytrends (requests-based) is blocked by Google (429), this module uses
Playwright to open a *headed* Chrome window.  The user signs in to Google
in that window, then the browser calls the Google Trends internal API
directly via page.evaluate() + fetch() — inheriting the browser's auth
cookies automatically.

Architecture
- discover_seeds_all_markets() → _bulk_sync() runs in a thread pool
  (Playwright is synchronous)
- _bulk_sync() opens ONE browser, scans all markets sequentially
- The browser profile is persisted so subsequent runs may skip sign-in
- Results are written to trend_seeds via a fresh async DB session
"""

import asyncio
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Set, Dict

from sqlalchemy.ext.asyncio import AsyncSession
from app.services.seed_service import load_seeds

logger = logging.getLogger(__name__)

PROFILE_DIR = Path(__file__).resolve().parents[3] / "data" / "playwright_profile"
_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pw_seed")

DISCOVERY_TIMEOUT = 180_000   # 3 min for user to sign in
PAGE_TIMEOUT = 30_000
# Be gentle to Google — sleep between requests
API_DELAY = 1.5

# ═══════════════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════════════

async def discover_seeds_all_markets(
    db: AsyncSession,
    markets: list,
    max_new_seeds: int = 30,
) -> dict:
    """Bulk discover seeds for *all* given markets with ONE browser window.

    Returns::

        {
            "results": [{"market": "MY", "new_seeds": 3, "errors": []}, ...],
            "total_new": 5,
        }
    """
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    seed_rows = await load_seeds(db, active_only=True)
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        _EXECUTOR, _bulk_sync, markets, max_new_seeds, seed_rows,
    )
    terms = result.pop("_terms", None)
    total = 0
    if terms:
        total = await _persist(db, terms, max_new_seeds)
    result["total_new"] = total
    return result


async def discover_seeds_from_google_trends(
    db: AsyncSession,
    market: str,
    max_new_seeds: int = 30,
    browser_session: Optional[dict] = None,
) -> dict:
    """Single-market convenience wrapper."""
    return await discover_seeds_all_markets(db, [market], max_new_seeds)


# ═══════════════════════════════════════════════════════════════════
#  Synchronous runner (thread-pool)
# ═══════════════════════════════════════════════════════════════════

def _bulk_sync(markets: list, max_new_seeds: int, seed_rows: list[dict]) -> dict:
    """Open headed Chrome, discover per market, close."""
    from playwright.sync_api import sync_playwright, Error as PwError

    pw = sync_playwright().start()
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    results: list = []
    discovered: Dict[str, Set[tuple[str, str]]] = {}
    seed_groups: dict[str, list[str]] = {}
    for row in seed_rows:
        seed_groups.setdefault(row["category_id"], []).append(row["keyword"])
    browser = None

    try:
        # --- launch persistent (headed) browser ------------------------
        browser = pw.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
            viewport={"width": 1440, "height": 900},
            locale="en-US",
            timezone_id="America/Los_Angeles",
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
            ),
        )
        page = browser.pages[0] if browser.pages else browser.new_page()
        logger.info("Playwright browser launched (headed)")

        # --- navigate & wait for user sign-in --------------------------
        page.goto(
            f"https://trends.google.com/trends/explore?geo={markets[0]}",
            timeout=PAGE_TIMEOUT,
        )
        logger.info(f"Browser opened trends page.  Waiting for user sign-in (max {DISCOVERY_TIMEOUT//1000}s)…")

        if not _wait_for_signin(page):
            results.append(_error("__all__", "未能在规定时间内登录 — 请在弹出的浏览器中登录 Google 账号后重试"))
            return {"results": results, "total_new": 0}

        logger.info("User signed in — starting discovery")
        time.sleep(2)

        # --- per-market scan -------------------------------------------
        for market in markets:
            m_errors, m_terms = [], set()
            try:
                page.goto(f"https://trends.google.com/trends/explore?geo={market}", timeout=PAGE_TIMEOUT)
                time.sleep(3)
            except PwError as exc:
                logger.debug("Google Trends navigation timeout during seed discovery: %s", exc)

            for cat_id, seeds in seed_groups.items():
                for seed in seeds[:1]:          # 1 per category = 13 req / market
                    try:
                        logger.info(f"  Fetching related queries for '{seed}' in {market}...")
                        new_terms = _fetch_related(page, seed, market)
                        m_terms |= {(term, cat_id) for term in new_terms}
                        if new_terms:
                            logger.info(f"    -> {len(new_terms)} terms from {seed}")
                        time.sleep(API_DELAY)
                    except Exception as e:
                        m_errors.append(f"{seed}: {_shorten(e)}")
                        if "429" in str(e) or "block" in str(e).lower():
                            break

            discovered[market] = m_terms
            results.append({
                "market": market,
                "new_seeds": len(m_terms),
                "errors": m_errors,
                "abort": False,
            })
            time.sleep(2)

        # --- close browser, persist results ----------------------------
        browser.close()
        browser = None

    except Exception as e:
        logger.exception("Seed discovery crashed")
        results.append(_error("__all__", f"浏览器错误: {_shorten(e)}"))
        if browser:
            try:
                browser.close()
            except Exception as close_exc:
                logger.debug("Failed to close seed discovery browser after crash: %s", close_exc)
    finally:
        try:
            pw.stop()
        except Exception as stop_exc:
            logger.debug("Failed to stop Playwright after seed discovery: %s", stop_exc)

    return {"results": results, "total_new": 0, "_terms": discovered}


# ═══════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════

def _shorten(e: Exception) -> str:
    m = str(e)
    if "429" in m: return "Google 要求验证(429)"
    if "timeout" in m.lower(): return "等待超时"
    return m[:120]


def _error(market: str, msg: str) -> dict:
    return {"market": market, "new_seeds": 0, "errors": [msg], "abort": True}


def _wait_for_signin(page) -> bool:
    """Block until the trends page shows a title that indicates successful load."""
    deadline = time.monotonic() + DISCOVERY_TIMEOUT / 1000
    while time.monotonic() < deadline:
        try:
            title = page.title()
        except Exception as exc:
            logger.debug("Unable to read Google Trends page title yet: %s", exc)
            time.sleep(3)
            continue
        if any(w in title.lower() for w in ("explore", "google trends", "探索", "google 趋势")):
            return True
        if "429" in title or "error" in title.lower():
            logger.info(f"Still blocked (\"{title}\"), waiting for user…")
        time.sleep(3)
    return False


# ═══════════════════════════════════════════════════════════════════
#  Google Trends internal API (called from browser JS context)
# ═══════════════════════════════════════════════════════════════════

def _fetch_related(page, seed: str, geo: str) -> Set[str]:
    """Call Trends explore + relatedsearches API from inside the browser."""
    payload = json.dumps({
        "comparisonItem": [{"keyword": seed, "time": "today 3-m", "geo": geo}],
        "category": 0, "property": "",
    }, separators=(",", ":"))

    js_explore = (
        "async ([req]) => {"
        "const u = 'https://trends.google.com/trends/api/explore?hl=en-US&tz=480&req=' + encodeURIComponent(req);"
        "const r = await fetch(u, {credentials: 'include'});"
        "const t = await r.text();"
        "return JSON.parse(t.slice(t.indexOf(String.fromCharCode(123))));"
        "}"
    )
    try:
        raw = page.evaluate(js_explore, [payload])
    except Exception as e:
        logger.warning(f"_fetch_related explore error for {seed}: {e}")
        return set()

    terms: set = set()
    for w in raw.get("widgets", []):
        if w.get("id") != "RELATED_QUERIES":
            continue
        token = w.get("token", "")
        ro = w.get("request", {})
        if not token:
            continue

        req2 = json.dumps({
            "restriction": ro.get("restriction", {}),
            "keywordType": ro.get("keywordType", "QUERY"),
            "metric": ["TOP", "RISING"],
            "trendinessSettings": ro.get("trendinessSettings", {}),
            "requestOptions": ro.get("requestOptions", {}),
            "language": ro.get("language", "en"),
            "userCountryCode": ro.get("userCountryCode", geo),
            "userConfig": {"userType": "USER_TYPE_SCRAPER"},
        }, separators=(",", ":"))

        try:
            js_related = (
                "async ([r2, tok]) => {"
                "const u = 'https://trends.google.com/trends/api/widgetdata/relatedsearches'"
                "+ '?hl=en-US&tz=480&req=' + encodeURIComponent(r2)"
                "+ '&token=' + tok;"
                "const r = await fetch(u, {credentials: 'include'});"
                "const t = await r.text();"
                "return JSON.parse(t.slice(t.indexOf(String.fromCharCode(123))));"
                "}"
            )
            data = page.evaluate(js_related, [req2, token])
        except Exception as exc:
            logger.debug("Related query widget failed for %s: %s", seed, exc)
            continue

        for ranked in data.get("default", {}).get("rankedList", []):
            for rk in ranked.get("rankedKeyword", []):
                q = (rk.get("query") or "").strip()
                if len(q) >= 3:
                    terms.add(q.lower())

    return terms


async def _persist(db, discovered: Dict[str, Set[tuple[str, str]]], max_per_market: int) -> int:
    """Write discovered terms to trend_seeds (runs in async context)."""
    from app.models.trend_seed import TrendSeed
    from sqlalchemy import select
    r = await db.execute(select(TrendSeed.keyword))
    existing = {row[0].lower() for row in r.all()}
    added = 0
    for market, terms in discovered.items():
        for term, category_id in list(terms)[:max_per_market]:
            if term in existing or len(term) > 200:
                continue
            db.add(TrendSeed(
                category_id=category_id, keyword=term, market=None,
                language="en", is_default=False, is_active=True,
                tags=["discovered", market],
            ))
            existing.add(term); added += 1
    if added:
        await db.commit()
        logger.info(f"Seed discovery: {added} new seeds persisted")
    return added

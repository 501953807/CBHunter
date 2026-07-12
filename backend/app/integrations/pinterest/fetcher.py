"""Pinterest Trends data fetcher — calls /metrics/ API with session cookies.

No browser needed for data collection — only needs cookies obtained from auth.py.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

METRICS_URL = "https://trends.pinterest.com/metrics/"
LATEST_DATE_URL = "https://trends.pinterest.com/latest_available_date/"
TOP_TRENDS_URL = "https://trends.pinterest.com/partner_top_trends_v2/"
AVAILABLE_INTERESTS_URL = "https://trends.pinterest.com/partner_available_interests_v2/"
BASE_HEADERS = {
    "x-requested-with": "XMLHttpRequest",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
}


async def get_latest_date(cookie_str: str) -> Optional[str]:
    """Get the latest available date for Pinterest Trends data."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(LATEST_DATE_URL, headers={**BASE_HEADERS, "cookie": cookie_str})
        if resp.status_code == 200:
            data = resp.json()
            return data.get("date")
    return None


async def fetch_keyword_metrics(
    keywords: list[str],
    country: str,
    days: int = 90,
    cookie_str: str = "",
    end_date: Optional[str] = None,
) -> list[dict]:
    """Fetch trend metrics for one or more keywords from Pinterest Trends.

    Args:
        keywords: List of search terms (e.g. ["summer dress", "yoga mat"])
        country: Country code (US, MY, PH, SG, etc.)
        days: Lookback window. Pinterest uses weekly aggregation:
              30 → ~5 data points, 90 → ~13, 365 → ~52
        cookie_str: Session cookie string from auth.login_and_get_session_string()
        end_date: Optional end date string (YYYY-MM-DD). Defaults to latest available.

    Returns:
        List of dicts, one per keyword:
        [{
            "term": "summer dress",
            "has_prediction": true,
            "counts": [{"date": "2026-04-17", "normalizedCount": 81, ...}, ...],
            "growth_rates": {"wow_change": 0.1, "mom_change": null, "yoy_change": null}
        }]
        Returns empty list if keyword has no data or if the API call fails.
    """
    if not keywords:
        return []

    # Join multiple terms with comma
    terms_param = ",".join(keywords)

    if not end_date:
        latest = await get_latest_date(cookie_str)
        end_date = latest or date.today().isoformat()

    params = {
        "terms": terms_param,
        "country": country,
        "end_date": end_date,
        "days": str(days),
        "aggregation": "2",
        "normalize_against_group": "false",
        "predicted_days": "0",
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                METRICS_URL,
                params=params,
                headers={**BASE_HEADERS, "cookie": cookie_str},
                timeout=30,
            )
            if resp.status_code == 200:
                data = resp.json()
                logger.debug(f"Pinterest metrics for {keywords}: {len(data)} results")
                return data
            elif resp.status_code == 401:
                logger.warning("Pinterest session expired, need to re-login")
                return []
            else:
                logger.warning(f"Pinterest metrics API returned {resp.status_code}")
                return []
        except Exception as e:
            logger.error(f"Pinterest metrics API error: {e}")
            return []


async def fetch_keyword_metric(
    keyword: str,
    country: str,
    days: int = 90,
    cookie_str: str = "",
    end_date: Optional[str] = None,
) -> Optional[dict]:
    """Fetch trend metrics for a single keyword."""
    results = await fetch_keyword_metrics([keyword], country, days, cookie_str, end_date)
    return results[0] if results else None


async def refresh_cookies(email: str, password: str) -> Optional[str]:
    """Re-login to Pinterest and return fresh cookie string."""
    from app.integrations.pinterest.auth import login_and_get_session_string
    return await login_and_get_session_string(email, password)


async def fetch_top_trends(country: str, cookie_str: str, lookback_window: int = 3, count: int = 50) -> list[dict]:
    """Fetch Pinterest's current top trending terms for a country.

    Args:
        country: Country code
        cookie_str: Session cookie string
        lookback_window: 1=30d, 2=60d, 3=90d
        count: Number of trending terms to return

    Returns:
        List of trending terms with their metadata
    """
    params = {
        "requested_term_count": str(count),
        "lookback_window": str(lookback_window),
        "trend_type": "2",
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                TOP_TRENDS_URL,
                params=params,
                headers={**BASE_HEADERS, "cookie": cookie_str},
                timeout=30,
            )
            if resp.status_code == 200:
                return resp.json().get("trending_terms", [])
            return []
        except Exception as e:
            logger.error(f"Pinterest top trends error: {e}")
            return []

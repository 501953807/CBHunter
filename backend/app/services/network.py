"""Network detection service — checks domestic and overseas reachability.

Usage:
    status = await NetworkChecker.check_status()
    # Returns {"status": "domestic"|"overseas"|"offline",
    #          "overseas": True/False,
    #          "domestic": True/False}
"""

import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

OVERSEAS_HOSTS = [
    "https://www.google.com",
    "https://www.youtube.com",
    "https://www.reddit.com",
]

DOMESTIC_HOSTS = [
    "https://www.baidu.com",
    "https://www.weibo.com",
]

_cached_status: Optional[dict] = None


async def _check_host(url: str, timeout: float = 3.0) -> bool:
    """Check if a host is reachable via HTTP GET."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url)
            return resp.status_code < 500
    except Exception as exc:
        logger.debug("Network reachability check failed for %s: %s", url, exc)
        return False


async def check_status(force_refresh: bool = False) -> dict:
    """Check network status. Cached for 60s unless force_refresh."""
    global _cached_status
    if _cached_status and not force_refresh:
        return _cached_status

    # Check domestic
    domestic_results = await asyncio.gather(
        *[_check_host(h) for h in DOMESTIC_HOSTS], return_exceptions=True
    )
    domestic_ok = any(r is True for r in domestic_results)

    # Check overseas
    overseas_results = await asyncio.gather(
        *[_check_host(h) for h in OVERSEAS_HOSTS], return_exceptions=True
    )
    overseas_ok = any(r is True for r in overseas_results)

    if domestic_ok and overseas_ok:
        status = "overseas"
    elif domestic_ok and not overseas_ok:
        status = "domestic"
    else:
        status = "offline"

    _cached_status = {
        "status": status,
        "overseas": overseas_ok,
        "domestic": domestic_ok,
        "overseas_hosts": {h.split("://")[1]: await _check_host(h) for h in OVERSEAS_HOSTS},
        "domestic_hosts": {h.split("://")[1]: await _check_host(h) for h in DOMESTIC_HOSTS},
    }
    return _cached_status


def requires_overseas():
    """Decorator factory for endpoints that need overseas network.

    Usage:
        @router.get("/overseas-feature")
        @requires_overseas()
        async def my_endpoint():
            ...
    """
    from functools import wraps
    from fastapi import HTTPException, status

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            status_data = await check_status()
            if not status_data["overseas"]:
                raise HTTPException(
                    status_code=status.HTTP_412_PRECONDITION_FAILED,
                    detail={
                        "code": "OVERSEAS_NETWORK_REQUIRED",
                        "message": "当前需要 VPN 环境访问外网，请开启 VPN 后重试",
                    },
                )
            return await func(*args, **kwargs)
        return wrapper
    return decorator

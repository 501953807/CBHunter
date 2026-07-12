"""Simple in-memory rate limiter — no external dependencies.

Uses a sliding-window counter per key (IP address by default).
"""

import time
import logging
from collections import defaultdict
from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)


class RateLimiter:
    """Thread-safe-ish in-memory rate limiter using sliding window."""

    def __init__(self, requests: int = 10, window_seconds: int = 60):
        self.requests = requests
        self.window = window_seconds
        self._store: dict[str, list[float]] = defaultdict(list)

    def _cleanup(self, key: str, now: float):
        """Remove timestamps outside the current window."""
        cutoff = now - self.window
        self._store[key] = [t for t in self._store[key] if t > cutoff]

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        self._cleanup(key, now)
        if len(self._store[key]) >= self.requests:
            return False
        self._store[key].append(now)
        return True

    def remaining(self, key: str) -> int:
        now = time.time()
        self._cleanup(key, now)
        return max(0, self.requests - len(self._store[key]))


# Pre-configured limiters
login_limiter = RateLimiter(requests=10, window_seconds=60)   # 10 req/min
register_limiter = RateLimiter(requests=5, window_seconds=60)  # 5 req/min


def get_client_key(request: Request) -> str:
    """Extract client identifier from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def check_login_rate(request: Request):
    """Rate limit for login endpoint."""
    key = get_client_key(request)
    if not login_limiter.is_allowed(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请稍后重试",
        )


async def check_register_rate(request: Request):
    """Rate limit for register endpoint."""
    key = get_client_key(request)
    if not register_limiter.is_allowed(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="注册请求过于频繁，请稍后重试",
        )

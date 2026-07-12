"""In-process authenticated WebSocket notification delivery."""

import asyncio
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)

TICKET_TTL_SECONDS = 60
_tickets: dict[str, tuple[str, datetime]] = {}
_connections: dict[str, set[WebSocket]] = {}
_lock: Optional[asyncio.Lock] = None
_lock_loop = None


def _get_lock() -> asyncio.Lock:
    """Create the lock only inside a running loop for Python 3.9 compatibility."""
    global _lock, _lock_loop
    loop = asyncio.get_running_loop()
    if _lock is None or _lock_loop is not loop:
        _lock = asyncio.Lock()
        _lock_loop = loop
    return _lock


async def issue_ticket(user_id: str) -> str:
    ticket = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=TICKET_TTL_SECONDS)
    async with _get_lock():
        _remove_expired_tickets()
        _tickets[ticket] = (user_id, expires_at)
    return ticket


async def consume_ticket(ticket: str) -> Optional[str]:
    async with _get_lock():
        _remove_expired_tickets()
        record = _tickets.pop(ticket, None)
    return record[0] if record else None


async def connect(user_id: str, websocket: WebSocket) -> None:
    await websocket.accept()
    async with _get_lock():
        _connections.setdefault(user_id, set()).add(websocket)


async def disconnect(user_id: str, websocket: WebSocket) -> None:
    async with _get_lock():
        connections = _connections.get(user_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            _connections.pop(user_id, None)


async def broadcast_notification(user_id: str, payload: dict) -> None:
    async with _get_lock():
        connections = list(_connections.get(user_id, set()))
    stale = []
    for websocket in connections:
        try:
            await websocket.send_json({"type": "notification", "data": payload})
        except Exception as exc:
            logger.warning("Realtime notification delivery failed for user %s: %s", user_id, exc)
            stale.append(websocket)
    for websocket in stale:
        await disconnect(user_id, websocket)


def _remove_expired_tickets() -> None:
    now = datetime.now(timezone.utc)
    expired = [ticket for ticket, (_, expires_at) in _tickets.items() if expires_at <= now]
    for ticket in expired:
        _tickets.pop(ticket, None)

"""Seed keyword service — DB-backed seed management for trend discovery.

Replaces the old code-level category seed dictionary. Seeds are loaded from the
trend_seeds table, with first-run defaults loaded from a data file when
the table is empty.

Also provides "seed discovery" — scanning Google Trends Top Charts /
Trending Searches for each market to find currently hot categories, then
using those to derive fresh seed keywords.
"""

import asyncio
import json
import logging
import random
import time
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

logger = logging.getLogger(__name__)

DEFAULT_SEEDS_PATH = Path(__file__).resolve().parents[1] / "data" / "default_trend_seeds.json"


@lru_cache(maxsize=1)
def _load_default_seeds() -> list[dict]:
    with DEFAULT_SEEDS_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("default_trend_seeds.json must contain a list")
    return data


async def load_seeds(
    db: AsyncSession,
    category_id: Optional[str] = None,
    market: Optional[str] = None,
    active_only: bool = True,
) -> list[dict]:
    """Load seed keywords from DB, seeding defaults on first run.

    Returns list of {category_id, keyword, market, language, is_default}.
    """
    from app.models.trend_seed import TrendSeed

    query = select(TrendSeed)
    if active_only:
        query = query.where(TrendSeed.is_active == True)
    if category_id:
        query = query.where(TrendSeed.category_id == category_id)
    if market:
        query = query.where(
            (TrendSeed.market == market) | (TrendSeed.market.is_(None))
        )

    query = query.order_by(TrendSeed.category_id, TrendSeed.market.nullsfirst())
    result = await db.execute(query)
    rows = list(result.scalars().all())

    if not rows:
        # First run — seed with built-in defaults
        rows = await _seed_defaults(db)
        if category_id:
            rows = [r for r in rows if r.category_id == category_id]

    return _serialize_rows(rows)


async def load_seeds_paginated(
    db: AsyncSession,
    category_id: Optional[str] = None,
    market: Optional[str] = None,
    active_only: bool = True,
    page: int = 1,
    page_size: int = 30,
) -> tuple[list[dict], int]:
    """Load seed keywords with pagination."""
    from app.models.trend_seed import TrendSeed

    # Base query for counting
    count_query = select(func.count(TrendSeed.id))
    if active_only:
        count_query = count_query.where(TrendSeed.is_active == True)
    if category_id:
        count_query = count_query.where(TrendSeed.category_id == category_id)
    if market:
        count_query = count_query.where(
            (TrendSeed.market == market) | (TrendSeed.market.is_(None))
        )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    if total == 0:
        rows = await _seed_defaults(db)
        if category_id:
            rows = [r for r in rows if r.category_id == category_id]
        total = len(rows)
        offset = (page - 1) * page_size
        return _serialize_rows(rows[offset:offset + page_size]), total

    query = select(TrendSeed)
    if active_only:
        query = query.where(TrendSeed.is_active == True)
    if category_id:
        query = query.where(TrendSeed.category_id == category_id)
    if market:
        query = query.where(
            (TrendSeed.market == market) | (TrendSeed.market.is_(None))
        )
    query = query.order_by(TrendSeed.category_id, TrendSeed.market.nullsfirst())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rows = list(result.scalars().all())
    return _serialize_rows(rows), total


def _serialize_rows(rows: list) -> list[dict]:
    return [
        {
            "id": r.id,
            "category_id": r.category_id,
            "keyword": r.keyword,
            "market": r.market,
            "language": r.language,
            "is_default": r.is_default,
            "is_active": r.is_active,
            "tags": r.tags or [],
            "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


async def _seed_defaults(db: AsyncSession) -> list:
    """Insert system default seeds from data file into the DB (idempotent)."""
    from app.models.trend_seed import TrendSeed

    existing = await db.execute(select(func.count(TrendSeed.id)))
    if existing.scalar() and existing.scalar() > 0:
        result = await db.execute(select(TrendSeed))
        return list(result.scalars().all())

    now = datetime.now(timezone.utc)
    added = []
    for s in _load_default_seeds():
        seed = TrendSeed(
            category_id=s["category_id"],
            keyword=s["keyword"],
            market=s.get("market"),
            language=s.get("language", "en"),
            is_default=True,
            is_active=True,
            tags=s.get("tags", []),
        )
        db.add(seed)
        added.append(seed)

    await db.commit()
    logger.info(f"Seeded {len(added)} default trend seeds")
    return added


async def mark_seed_used(db: AsyncSession, seed_id: str) -> None:
    """Update last_used_at timestamp for a seed."""
    from app.models.trend_seed import TrendSeed

    result = await db.execute(select(TrendSeed).where(TrendSeed.id == seed_id))
    seed = result.scalar_one_or_none()
    if seed:
        seed.last_used_at = datetime.now(timezone.utc)
        await db.commit()


async def upsert_seed(db: AsyncSession, data: dict) -> dict:
    """Create or update a seed keyword."""
    from app.models.trend_seed import TrendSeed

    seed_id = data.get("id")
    if seed_id:
        result = await db.execute(select(TrendSeed).where(TrendSeed.id == seed_id))
        seed = result.scalar_one_or_none()
        if not seed:
            raise ValueError(f"Seed {seed_id} not found")
    else:
        seed = TrendSeed()
        db.add(seed)

    for field in ("category_id", "keyword", "market", "language", "is_active", "is_default", "tags"):
        if field in data:
            setattr(seed, field, data[field])

    await db.commit()
    await db.refresh(seed)
    return {
        "id": seed.id, "category_id": seed.category_id,
        "keyword": seed.keyword, "market": seed.market,
        "language": seed.language, "is_default": seed.is_default,
        "is_active": seed.is_active, "tags": seed.tags or [],
    }


async def delete_seed(db: AsyncSession, seed_id: str) -> bool:
    """Delete a seed keyword."""
    from app.models.trend_seed import TrendSeed
    from sqlalchemy import delete as sql_delete

    result = await db.execute(sql_delete(TrendSeed).where(TrendSeed.id == seed_id))
    await db.commit()
    return result.rowcount > 0


async def reset_to_defaults(db: AsyncSession) -> int:
    """Delete all non-default seeds and re-insert built-in defaults."""
    from app.models.trend_seed import TrendSeed
    from sqlalchemy import delete as sql_delete

    # Delete only non-default seeds
    await db.execute(
        sql_delete(TrendSeed).where(TrendSeed.is_default == False)
    )
    await db.commit()

    # Re-insert defaults (idempotent)
    seeds = await _seed_defaults(db)
    return len(seeds)

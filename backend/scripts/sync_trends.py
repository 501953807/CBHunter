#!/usr/bin/env python3
"""CBHunter Trend Data Sync — standalone automated sync script.
Run with VPN connected to fetch Google Trends + Pinterest data.
Usage:
    cd backend && source venv/bin/activate
    python3 scripts/sync_trends.py
"""
import asyncio
import os
import sys
import logging

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger('sync_trends')

async def main():
    from app.database import async_session
    from app.services.trend_service import fetch_all_trends

    logger.info("=== CBHunter Trend Data Sync ===")
    logger.info("Starting full trend discovery (Google Trends + Pinterest)...")

    try:
        async with async_session() as db:
            result = await fetch_all_trends(db)
    except Exception as e:
        logger.error(f"Sync failed: {e}", exc_info=True)
        return 1

    logger.info("=== Sync Complete ===")
    logger.info(f"Google Trends: {result.get('google_trends', 0)} keywords")
    logger.info(f"Pinterest:     {result.get('pinterest', 0)} keywords")
    logger.info(f"Cross-val:     {result.get('cross_validated', 0)} keywords")
    logger.info(f"Total:         {result.get('total', 0)} keywords")

    if result.get('errors'):
        logger.warning("Errors encountered:")
        for err in result.get('errors', []):
            logger.warning(f"  - {err}")

    if result.get('message'):
        logger.info(f"Message: {result['message']}")

    # Verify DB state
    from app.models.trend_keyword import TrendKeyword
    from sqlalchemy import select, func

    async with async_session() as db:
        total = await db.execute(select(func.count(TrendKeyword.id)))
        pinned = await db.execute(select(func.count(TrendKeyword.id)).where(TrendKeyword.has_pinterest_data == True))

        logger.info(f"DB State: {total.scalar()} total, {pinned.scalar()} with Pinterest data")

        # Show sample
        result = await db.execute(
            select(TrendKeyword).order_by(TrendKeyword.search_volume.desc().nullslast()).limit(5)
        )
        logger.info("Top 5 keywords:")
        for kw in result.scalars().all():
            logger.info(f"  {kw.keyword:30s} | {kw.market:3s} | {kw.category:15s} | vol={kw.search_volume} | {kw.trend_direction or '-'} | src={kw.source}")

    return 0

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))

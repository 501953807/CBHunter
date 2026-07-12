"""Signal service — persisted replacement for scout.py in-memory signal store."""
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, or_

from app.models.signal import Signal


async def list_signals(
    db: AsyncSession,
    user_id: str,
    layer: Optional[str] = None,
    source: Optional[str] = None,
    analysis_status: Optional[str] = None,
    converted: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Signal], int]:
    """List signals with filters."""
    query = select(Signal).where(Signal.user_id == user_id)

    if layer:
        query = query.where(Signal.layer == layer)
    if source:
        query = query.where(Signal.source == source)
    if analysis_status:
        query = query.where(Signal.analysis_status == analysis_status)
    if converted is not None:
        query = query.where(Signal.converted == converted)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Signal.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def create_signal(db: AsyncSession, user_id: str, data: dict) -> Signal:
    """Create a new signal."""
    signal = Signal(
        user_id=user_id,
        layer=data.get("layer", "trend"),
        source=data.get("source", "manual"),
        title=data.get("title", ""),
        content=data.get("content"),
        source_url=data.get("source_url"),
        source_image=data.get("source_image"),
        analysis_status="pending",
    )
    db.add(signal)
    await db.commit()
    await db.refresh(signal)
    return signal


async def get_signal(db: AsyncSession, signal_id: str, user_id: str) -> Optional[Signal]:
    """Get a single signal."""
    result = await db.execute(
        select(Signal).where(Signal.id == signal_id, Signal.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def analyze_signal(
    db: AsyncSession,
    signal_id: str,
    user_id: str,
    analysis_result: dict,
    confidence: str = "medium",
) -> Optional[Signal]:
    """Store AI analysis result for a signal."""
    signal = await get_signal(db, signal_id, user_id)
    if not signal:
        return None

    signal.analysis_status = "completed"
    signal.analysis_result = analysis_result
    signal.confidence = confidence
    await db.commit()
    await db.refresh(signal)
    return signal


async def mark_converted(
    db: AsyncSession,
    signal_id: str,
    user_id: str,
    sourcing_item_id: str,
) -> Optional[Signal]:
    """Mark signal as converted to a sourcing item."""
    signal = await get_signal(db, signal_id, user_id)
    if not signal:
        return None

    signal.converted = True
    signal.sourcing_item_id = sourcing_item_id
    await db.commit()
    await db.refresh(signal)
    return signal


async def delete_signal(db: AsyncSession, signal_id: str, user_id: str) -> bool:
    """Delete a signal."""
    result = await db.execute(
        delete(Signal).where(Signal.id == signal_id, Signal.user_id == user_id)
    )
    await db.commit()
    return result.rowcount > 0


async def get_signal_stats(db: AsyncSession, user_id: str) -> dict:
    """Get signal statistics by layer."""
    result = await db.execute(
        select(Signal).where(Signal.user_id == user_id)
    )
    items = list(result.scalars().all())

    stats = {"total": len(items), "by_layer": {}, "by_status": {}, "pending_conversion": 0}
    for s in items:
        stats["by_layer"][s.layer] = stats["by_layer"].get(s.layer, 0) + 1
        stats["by_status"][s.analysis_status] = stats["by_status"].get(s.analysis_status, 0) + 1
        if not s.converted:
            stats["pending_conversion"] += 1

    return stats

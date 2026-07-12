"""Notification service — CRUD + auto-generate business alerts."""

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.notification import Notification

logger = logging.getLogger(__name__)


async def get_unread_count(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(func.count()).where(
            Notification.user_id == user_id,
            Notification.read == False,
        )
    )
    return result.scalar() or 0


async def list_notifications(
    db: AsyncSession, user_id: str,
    type: str = None, unread_only: bool = False, limit: int = 50,
) -> list[dict]:
    q = select(Notification).where(Notification.user_id == user_id)
    if type:
        q = q.where(Notification.type == type)
    if unread_only:
        q = q.where(Notification.read == False)
    q = q.order_by(Notification.created_at.desc()).limit(limit)

    result = await db.execute(q)
    return [
        {
            "id": n.id, "type": n.type, "level": n.level,
            "title": n.title, "message": n.message,
            "link": n.link, "read": n.read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in result.scalars().all()
    ]


async def create_notification(db: AsyncSession, user_id: str, **kwargs) -> dict:
    """Create a notification. Dedup: skip if same title+user in last 24h."""
    from datetime import datetime, timezone, timedelta

    # Dedup check
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    existing = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.title == kwargs.get("title", ""),
            Notification.created_at >= cutoff,
        )
    )
    if existing.scalar_one_or_none():
        return None  # Already notified

    notif = Notification(user_id=user_id, **kwargs)
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    payload = {
        "id": notif.id,
        "type": notif.type,
        "level": notif.level,
        "title": notif.title,
        "message": notif.message,
        "link": notif.link,
        "read": notif.read,
        "created_at": notif.created_at.isoformat() if notif.created_at else None,
    }
    from app.services.realtime_service import broadcast_notification
    await broadcast_notification(user_id, payload)
    return payload


async def mark_read(db: AsyncSession, user_id: str, notification_id: str) -> bool:
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    )
    n = result.scalar_one_or_none()
    if n:
        n.read = True
        await db.commit()
        return True
    return False


async def mark_all_read(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(Notification).where(Notification.user_id == user_id, Notification.read == False)
    )
    count = 0
    for n in result.scalars().all():
        n.read = True
        count += 1
    if count:
        await db.commit()
    return count


async def check_pricing_alerts(db: AsyncSession, user_id: str):
    """Auto-generate alert if fee templates are missing for any configured platform."""
    from app.models.fee_template import FeeTemplate
    from app.models.platform_account import PlatformAccount
    from app.services.store_access_service import list_accessible_store_ids_for_user_id

    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    accounts = await db.execute(select(PlatformAccount).where(PlatformAccount.id.in_(store_ids)))
    platforms_used = set(a.platform for a in accounts.scalars().all())

    for platform in platforms_used:
        result = await db.execute(
            select(FeeTemplate).where(FeeTemplate.platform == platform, FeeTemplate.is_active == True)
        )
        if not result.scalar_one_or_none():
            await create_notification(db, user_id,
                type="alert", level="warning",
                title=f"{platform} 平台费率未配置",
                message=f"智能定价功能需要{platform}的费率模板才能准确计算。请前往设置中心→平台费率进行配置。",
                link="/settings/fees",
            )

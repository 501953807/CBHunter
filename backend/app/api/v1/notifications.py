"""Notifications API — real DB-backed with auto business alerts."""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import notification_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=ApiResponse)
async def list_notifications(
    type: Optional[str] = Query(None),
    unread_only: bool = Query(False),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List notifications with optional filtering."""
    items = await notification_service.list_notifications(
        db, current_user.id, type=type, unread_only=unread_only, limit=limit,
    )
    unread_count = await notification_service.get_unread_count(db, current_user.id)
    return ApiResponse(data={
        "notifications": items,
        "unread_count": unread_count,
        "total": len(items),
    }, status="ready" if items else "data_required",
       source_refs=[source_ref("notification", item["id"], label=item["title"]) for item in items],
       evidence_window=f"当前用户最近 {limit} 条通知",
       confidence_reason="列表仅包含当前用户数据库通知，筛选和未读数均来自真实记录。",
       data_gaps=[] if items else ["当前筛选下暂无通知记录"])


@router.put("/{notification_id}/read", response_model=ApiResponse)
async def mark_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )
    notification = result.scalar_one_or_none()
    old_value = _notification_snapshot(notification)
    ok = await notification_service.mark_read(db, current_user.id, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="通知不存在")
    await record_audit_event(
        db,
        user=current_user,
        action="notification_mark_read",
        resource_type="notification",
        resource_id=notification_id,
        old_value=old_value,
        new_value={**(old_value or {}), "read": True},
        detail="标记单条通知已读",
    )
    return ApiResponse(data={"status": "read"})


@router.put("/read-all", response_model=ApiResponse)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    unread_before = await notification_service.get_unread_count(db, current_user.id)
    count = await notification_service.mark_all_read(db, current_user.id)
    await record_audit_event(
        db,
        user=current_user,
        action="notification_mark_all_read",
        resource_type="notification",
        resource_id=current_user.id,
        old_value={"unread_count": unread_before},
        new_value={"marked": count, "unread_count": 0 if count else unread_before},
        detail="批量标记通知已读",
    )
    return ApiResponse(data={"status": "all_read", "marked": count})


@router.post("/check-alerts", response_model=ApiResponse)
async def check_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger business alert checks (fee templates, rate configs, etc)."""
    unread_before = await notification_service.get_unread_count(db, current_user.id)
    await notification_service.check_pricing_alerts(db, current_user.id)
    unread = await notification_service.get_unread_count(db, current_user.id)
    await record_audit_event(
        db,
        user=current_user,
        action="notification_alert_check",
        resource_type="notification",
        resource_id=current_user.id,
        old_value={"unread_count": unread_before},
        new_value={"unread_count": unread, "created_or_existing_delta": unread - unread_before},
        detail="手工检查业务预警通知",
    )
    return ApiResponse(data={"alerts_checked": True, "unread_count": unread})


def _notification_snapshot(notification: Optional[Notification]) -> Optional[dict]:
    if not notification:
        return None
    return {
        "id": notification.id,
        "type": notification.type,
        "level": notification.level,
        "title": notification.title,
        "link": notification.link,
        "read": notification.read,
        "created_at": notification.created_at,
    }

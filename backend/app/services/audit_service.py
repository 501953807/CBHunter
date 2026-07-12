"""Audit log service — write and query audit trail entries."""

import json
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


async def create_audit_log(
    db: AsyncSession,
    user_id: str,
    username: str,
    action: str,
    resource_type: str,
    resource_id: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    detail: Optional[str] = None,
) -> AuditLog:
    """Write a single audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        old_value=old_value,
        new_value=new_value,
        detail=detail,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def record_audit_event(
    db: AsyncSession,
    *,
    user,
    action: str,
    resource_type: str,
    resource_id: str,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    detail: Optional[str] = None,
) -> AuditLog:
    """Write an audit event using structured values."""
    return await create_audit_log(
        db,
        user_id=user.id,
        username=getattr(user, "username", "") or getattr(user, "email", "") or "unknown",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        old_value=_json_or_none(old_value),
        new_value=_json_or_none(new_value),
        detail=detail,
    )


async def query_audit_logs(
    db: AsyncSession,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AuditLog], int]:
    """Query audit logs with optional filters. Returns (items, total)."""
    stmt = select(AuditLog)
    count_stmt = select(func.count(AuditLog.id))

    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
        count_stmt = count_stmt.where(AuditLog.user_id == user_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
        count_stmt = count_stmt.where(AuditLog.action == action)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
        count_stmt = count_stmt.where(AuditLog.resource_type == resource_type)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= date_from)
        count_stmt = count_stmt.where(AuditLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(AuditLog.created_at <= date_to)
        count_stmt = count_stmt.where(AuditLog.created_at <= date_to)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    stmt = stmt.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return list(items), total


def _json_or_none(value: Optional[dict]) -> Optional[str]:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, default=str)

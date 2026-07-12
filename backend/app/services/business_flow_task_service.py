"""Business-flow task ownership and batch action service."""

from datetime import datetime, timezone

import json

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.business_flow_task import BusinessFlowTask
from app.models.user import User
from app.schemas.business_flow import (
    BusinessFlowTaskBulkRequest,
    BusinessFlowTaskCommentRequest,
    BusinessFlowTaskCompleteReviewRequest,
    BusinessFlowTaskItemRef,
)
from app.services.audit_service import record_audit_event
from app.services.notification_service import create_notification


VALID_STATUS = {"open", "processing", "done", "cancelled"}
VALID_PRIORITY = {"low", "normal", "high", "urgent"}


async def list_flow_tasks(db: AsyncSession, user_id: str) -> dict[tuple[str, str], BusinessFlowTask]:
    result = await db.execute(
        select(BusinessFlowTask).where(
            BusinessFlowTask.user_id == user_id,
            BusinessFlowTask.is_active.is_(True),
        )
    )
    return {(item.item_type, item.item_id): item for item in result.scalars().all()}


async def list_flow_task_assignees(db: AsyncSession, current_user: User) -> list[dict]:
    if current_user.is_admin:
        result = await db.execute(select(User).where(User.is_active.is_(True)).order_by(User.username.asc()))
        users = list(result.scalars().all())
    else:
        users = [current_user]
    return [{
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name or user.username,
        "is_current": user.id == current_user.id,
    } for user in users]


def merge_task_into_item(item: dict, task: BusinessFlowTask | None, current_user_id: str) -> dict:
    next_item = dict(item)
    if not task:
        next_item.update({
            "task_id": None,
            "task_status": None,
            "assigned_to": None,
            "is_followed": False,
            "priority": None,
            "task_note": None,
        })
        return next_item
    followed_by = task.followed_by if isinstance(task.followed_by, list) else []
    next_item.update({
        "task_id": task.id,
        "task_status": task.status,
        "assigned_to": task.assigned_to,
        "is_followed": current_user_id in followed_by,
        "priority": task.priority,
        "task_note": task.note,
    })
    return next_item


async def bulk_update_flow_tasks(
    db: AsyncSession,
    current_user: User,
    request: BusinessFlowTaskBulkRequest,
) -> list[dict]:
    _validate_request(request)
    tasks = await list_flow_tasks(db, current_user.id)
    changed: list[BusinessFlowTask] = []
    snapshots: list[tuple[BusinessFlowTask, dict | None]] = []
    now = datetime.now(timezone.utc)
    for item_ref in request.items:
        key = (item_ref.item_type, item_ref.item_id)
        task = tasks.get(key)
        old_value = _snapshot(task)
        if not task:
            task = _new_task(current_user.id, item_ref)
            tasks[key] = task
            db.add(task)
        _apply_action(task, current_user, request)
        task.updated_at = now
        snapshots.append((task, old_value))
        changed.append(task)

    await db.commit()
    for task in changed:
        await db.refresh(task)

    for task, old_value in snapshots:
        await record_audit_event(
            db,
            user=current_user,
            action=f"business_flow_task_{request.action}",
            resource_type="business_flow_task",
            resource_id=task.id,
            old_value=old_value,
            new_value=_snapshot(task),
            detail=request.note,
        )
        if request.action == "assign" and request.assigned_to:
            await _notify_assignee(db, current_user, task, request.assigned_to)
    return [_payload(task, current_user.id) for task in changed]


async def add_flow_task_comment(
    db: AsyncSession,
    current_user: User,
    task_id: str,
    request: BusinessFlowTaskCommentRequest,
) -> dict:
    task = await _get_owned_task(db, current_user.id, task_id)
    event = await record_audit_event(
        db,
        user=current_user,
        action="business_flow_task_comment",
        resource_type="business_flow_task",
        resource_id=task.id,
        new_value={"comment": request.comment},
        detail=request.comment,
    )
    return _event_payload(event)


async def complete_flow_task_with_review(
    db: AsyncSession,
    current_user: User,
    task_id: str,
    request: BusinessFlowTaskCompleteReviewRequest,
) -> dict:
    task = await _get_owned_task(db, current_user.id, task_id)
    old_value = _snapshot(task)
    task.status = "done"
    task.note = request.outcome
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    await record_audit_event(
        db,
        user=current_user,
        action="business_flow_task_completed_review",
        resource_type="business_flow_task",
        resource_id=task.id,
        old_value=old_value,
        new_value={
            **(_snapshot(task) or {}),
            "outcome": request.outcome,
            "impact_score": request.impact_score,
            "next_action": request.next_action,
        },
        detail=request.outcome,
    )
    return _payload(task, current_user.id)


async def list_flow_task_events(db: AsyncSession, current_user: User, task_id: str) -> list[dict]:
    await _get_owned_task(db, current_user.id, task_id)
    result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.user_id == current_user.id,
            AuditLog.resource_type == "business_flow_task",
            AuditLog.resource_id == task_id,
        )
        .order_by(desc(AuditLog.created_at), desc(AuditLog.id))
        .limit(30)
    )
    return [_event_payload(item) for item in result.scalars().all()]


def _validate_request(request: BusinessFlowTaskBulkRequest) -> None:
    if request.action == "assign" and not request.assigned_to:
        raise ValueError("assigned_to_required")
    if request.action == "set_status" and request.status not in VALID_STATUS:
        raise ValueError("valid_status_required")
    if request.action == "set_priority" and request.priority not in VALID_PRIORITY:
        raise ValueError("valid_priority_required")


def _new_task(user_id: str, item_ref: BusinessFlowTaskItemRef) -> BusinessFlowTask:
    return BusinessFlowTask(
        user_id=user_id,
        item_type=item_ref.item_type,
        item_id=item_ref.item_id,
        stage_key=item_ref.stage_key,
        title=item_ref.title,
        route=item_ref.route,
        status="open",
        priority="normal",
        source_refs=item_ref.source_refs,
        last_gap=item_ref.last_gap,
        followed_by=[],
        is_active=True,
    )


def _apply_action(task: BusinessFlowTask, current_user: User, request: BusinessFlowTaskBulkRequest) -> None:
    task.source_refs = task.source_refs or []
    if request.action == "assign":
        task.assigned_to = request.assigned_to
        task.status = "processing" if task.status == "open" else task.status
    elif request.action == "follow":
        followed_by = task.followed_by if isinstance(task.followed_by, list) else []
        task.followed_by = sorted(set(followed_by + [current_user.id]))
    elif request.action == "unfollow":
        followed_by = task.followed_by if isinstance(task.followed_by, list) else []
        task.followed_by = [item for item in followed_by if item != current_user.id]
    elif request.action == "set_status" and request.status:
        task.status = request.status
    elif request.action == "set_priority" and request.priority:
        task.priority = request.priority
    if request.note is not None:
        task.note = request.note


def _payload(task: BusinessFlowTask, current_user_id: str) -> dict:
    followed_by = task.followed_by if isinstance(task.followed_by, list) else []
    return {
        "id": task.id,
        "item_type": task.item_type,
        "item_id": task.item_id,
        "stage_key": task.stage_key,
        "title": task.title,
        "route": task.route,
        "status": task.status,
        "priority": task.priority,
        "assigned_to": task.assigned_to,
        "is_followed": current_user_id in followed_by,
        "last_gap": task.last_gap,
        "note": task.note,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }


def _snapshot(task: BusinessFlowTask | None) -> dict | None:
    if not task:
        return None
    return {
        "status": task.status,
        "priority": task.priority,
        "assigned_to": task.assigned_to,
        "followed_by": task.followed_by,
        "last_gap": task.last_gap,
        "note": task.note,
    }


async def _get_owned_task(db: AsyncSession, user_id: str, task_id: str) -> BusinessFlowTask:
    result = await db.execute(
        select(BusinessFlowTask).where(
            BusinessFlowTask.id == task_id,
            BusinessFlowTask.user_id == user_id,
            BusinessFlowTask.is_active.is_(True),
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise ValueError("business_flow_task_not_found")
    return task


def _event_payload(event: AuditLog) -> dict:
    payload = _parse_json(event.new_value) or {}
    old_payload = _parse_json(event.old_value)
    return {
        "id": event.id,
        "action": event.action,
        "resource_id": event.resource_id,
        "detail": event.detail,
        "payload": payload,
        "old_payload": old_payload,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "username": event.username,
    }


def _parse_json(value: str | None) -> dict | None:
    if not value:
        return None
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {"raw": value}
    return parsed if isinstance(parsed, dict) else {"value": parsed}


async def _notify_assignee(db: AsyncSession, current_user: User, task: BusinessFlowTask, assigned_to: str) -> None:
    result = await db.execute(
        select(User).where(
            User.username == assigned_to,
            User.is_active.is_(True),
        )
    )
    assignee = result.scalar_one_or_none()
    if not assignee or assignee.id == current_user.id:
        return
    await create_notification(
        db,
        assignee.id,
        type="system",
        level="info",
        title=f"你有新的业务任务：{task.title}",
        message=f"{current_user.username} 将任务「{task.title}」分配给你。缺口：{task.last_gap or '无阻塞缺口'}",
        link="/business-flow",
    )

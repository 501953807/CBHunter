"""AI task execution governance: entitlement, audit trail, and quota usage."""

import logging
from time import perf_counter
from typing import Awaitable, Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.audit_service import record_audit_event
from app.services.entitlement_service import consume_quota, require_entitlement
from app.services.task_executor import TaskResult, execute_task

logger = logging.getLogger(__name__)

AI_TASK_QUOTA_FEATURE = "ai.tasks.monthly"
AI_TASK_AUDIT_ACTION = "ai_task_execute"

Executor = Callable[..., Awaitable[TaskResult]]


async def execute_governed_ai_task(
    db: AsyncSession,
    user: User,
    task_type: str,
    input_data: dict,
    *,
    object_type: str = "ai_task",
    object_id: Optional[str] = None,
    source: str = "task_executor",
    image_path: Optional[str] = None,
    preferred_providers: Optional[list[str]] = None,
    quota_feature: str = AI_TASK_QUOTA_FEATURE,
    executor: Executor = execute_task,
) -> TaskResult:
    """Run an AI task and record whether it consumed quota.

    Quota is only consumed when the executor returns a successful, non-empty result.
    Failed, exception, timeout-like, and empty results are still written to audit.
    """
    await require_entitlement(db, user, quota_feature)
    started = perf_counter()
    try:
        result = await executor(
            db,
            task_type,
            input_data,
            image_path=image_path,
            preferred_providers=preferred_providers,
        )
    except Exception as exc:
        logger.warning("AI task execution failed before result: %s", exc)
        result = TaskResult(False, error=str(exc))
    duration_ms = int((perf_counter() - started) * 1000)
    await finalize_ai_task_result(
        db,
        user,
        task_type,
        result,
        object_type=object_type,
        object_id=object_id,
        source=source,
        duration_ms=duration_ms,
        quota_feature=quota_feature,
    )
    return result


async def finalize_ai_task_result(
    db: AsyncSession,
    user: User,
    task_type: str,
    result: TaskResult,
    *,
    object_type: str = "ai_task",
    object_id: Optional[str] = None,
    source: str = "task_executor",
    duration_ms: Optional[int] = None,
    quota_feature: str = AI_TASK_QUOTA_FEATURE,
) -> dict:
    """Audit a completed AI task and consume quota only for billable output."""
    billable = is_billable_ai_result(result)
    quota_usage = None
    if billable:
        quota_usage = await consume_quota(db, user, quota_feature)

    payload = build_ai_task_audit_payload(
        task_type,
        result,
        object_type=object_type,
        object_id=object_id,
        source=source,
        duration_ms=duration_ms,
        quota_feature=quota_feature,
        quota_charged=billable,
        quota_usage=quota_usage,
    )
    await record_audit_event(
        db,
        user=user,
        action=AI_TASK_AUDIT_ACTION,
        resource_type="ai_task",
        resource_id=object_id or task_type,
        new_value=payload,
        detail=f"AI任务{_status_label(payload['status'])}：{task_type}",
    )
    return payload


def build_ai_task_audit_payload(
    task_type: str,
    result: TaskResult,
    *,
    object_type: str = "ai_task",
    object_id: Optional[str] = None,
    source: str = "task_executor",
    duration_ms: Optional[int] = None,
    quota_feature: str = AI_TASK_QUOTA_FEATURE,
    quota_charged: bool = False,
    quota_usage: Optional[dict] = None,
) -> dict:
    """Build the structured audit payload for one AI task execution."""
    status = _task_result_status(result)
    payload = {
        "task_type": task_type,
        "object_type": object_type,
        "object_id": object_id,
        "provider": result.provider or "",
        "confidence": result.confidence or "",
        "status": status,
        "source": source,
        "duration_ms": max(duration_ms or 0, 0),
        "quota_feature": quota_feature,
        "quota_charged": quota_charged,
        "error": result.error or "",
    }
    if quota_usage:
        payload["quota_period"] = quota_usage.get("period_key")
        payload["quota_used_value"] = quota_usage.get("used_value")
    return payload


def is_billable_ai_result(result: TaskResult) -> bool:
    """Return True only when an AI result contains useful generated output."""
    if not result.success:
        return False
    return _has_non_empty_value(result.data)


def _task_result_status(result: TaskResult) -> str:
    if not result.success:
        return "failed"
    if not _has_non_empty_value(result.data):
        return "empty"
    return "success"


def _has_non_empty_value(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set)):
        return any(_has_non_empty_value(item) for item in value)
    if isinstance(value, dict):
        return any(_has_non_empty_value(item) for item in value.values())
    return True


def _status_label(status: str) -> str:
    labels = {"success": "成功", "failed": "失败", "empty": "空结果"}
    return labels.get(status, status)

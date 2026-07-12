"""System tasks monitoring API — view & manually trigger APScheduler jobs."""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/settings/tasks",
    tags=["tasks"],
    dependencies=[Depends(require_admin)],
)

TASK_LABELS = {
    "sync_orders": {"name": "订单同步", "description": "同步 Shopee/TikTok/TEMU 订单"},
    "analytics_snapshot": {"name": "数据快照", "description": "创建每日分析快照"},
    "fetch_trends": {"name": "趋势采集", "description": "Google Trends + Pinterest Trends 采集与交叉验证"},
    "sync_trending": {"name": "热卖商品同步", "description": "同步 Shopee/TikTok/TEMU 热卖榜单"},
    "dispatch_reports": {"name": "报表订阅投递", "description": "向站内通知中心投递到期报表订阅"},
}


class TaskToggleRequest(BaseModel):
    enabled: bool


class TaskTriggerUpdateRequest(BaseModel):
    interval_seconds: int


def _get_scheduler():
    """Get the APScheduler instance."""
    from app.tasks.scheduler import scheduler
    return scheduler


@router.get("/", response_model=ApiResponse)
async def list_tasks():
    """获取所有注册的定时任务状态。"""
    scheduler = _get_scheduler()
    jobs = scheduler.get_jobs()

    items = []
    for job in jobs:
        meta = TASK_LABELS.get(job.id, {"name": job.id, "description": ""})
        interval = getattr(job.trigger, "interval", None)
        items.append({
            "id": job.id,
            "name": meta["name"],
            "description": meta["description"],
            "trigger": str(job.trigger),
            "interval_seconds": int(interval.total_seconds()) if interval else None,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "enabled": job.next_run_time is not None,
        })

    return ApiResponse(
        data={"tasks": items, "total": len(items)},
        status="ready" if items else "configuration_required",
        source_refs=[source_ref("scheduler_job", item["id"], label=item["name"]) for item in items],
        evidence_window="当前系统定时任务",
        confidence_reason="启停状态、触发器与下次执行时间直接读取当前调度器。",
        data_gaps=[] if items else ["当前调度器未注册任务"],
    )


@router.patch("/{task_id}", response_model=ApiResponse)
async def toggle_task(
    task_id: str,
    req: TaskToggleRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """启用/禁用定时任务。"""
    scheduler = _get_scheduler()
    job = scheduler.get_job(task_id)
    if not job:
        raise HTTPException(404, f"任务 '{task_id}' 不存在")
    old_enabled = job.next_run_time is not None

    if req.enabled:
        scheduler.resume_job(task_id)
        logger.info(f"Task '{task_id}' resumed")
    else:
        scheduler.pause_job(task_id)
        logger.info(f"Task '{task_id}' paused")

    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="system_task",
        resource_id=task_id,
        old_value={"enabled": old_enabled},
        new_value={"enabled": req.enabled},
        detail="启用或禁用后台任务",
    )
    return ApiResponse(data={"id": task_id, "enabled": req.enabled})


@router.put("/{task_id}/trigger", response_model=ApiResponse)
async def update_task_trigger(
    task_id: str,
    req: TaskTriggerUpdateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update an interval task trigger."""
    if req.interval_seconds < 60 or req.interval_seconds > 31 * 24 * 60 * 60:
        raise HTTPException(400, "任务间隔必须在 60 秒至 31 天之间")
    scheduler = _get_scheduler()
    job = scheduler.get_job(task_id)
    if not job:
        raise HTTPException(404, f"任务 '{task_id}' 不存在")
    old_trigger = str(job.trigger)
    scheduler.reschedule_job(task_id, trigger="interval", seconds=req.interval_seconds)
    logger.info("Task '%s' interval updated to %s seconds", task_id, req.interval_seconds)
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="system_task_trigger",
        resource_id=task_id,
        old_value={"trigger": old_trigger},
        new_value={"interval_seconds": req.interval_seconds},
        detail="调整后台任务执行间隔",
    )
    return ApiResponse(data={"id": task_id, "interval_seconds": req.interval_seconds})


@router.post("/{task_id}/run", response_model=ApiResponse)
async def trigger_task(
    task_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """手动触发指定后台任务立即执行。"""
    scheduler = _get_scheduler()
    job = scheduler.get_job(task_id)
    if not job:
        raise HTTPException(404, f"任务 '{task_id}' 不存在")

    try:
        await job.func()
        logger.info(f"Task '{task_id}' manually triggered successfully")
        await record_audit_event(
            db,
            user=current_user,
            action="run",
            resource_type="system_task",
            resource_id=task_id,
            new_value={"status": "success"},
            detail="手工执行后台任务",
        )
        return ApiResponse(data={"message": f"任务 '{task_id}' 已触发并执行完成"})
    except Exception as e:
        logger.error(f"Task '{task_id}' manual trigger failed: {e}")
        await record_audit_event(
            db,
            user=current_user,
            action="run_failed",
            resource_type="system_task",
            resource_id=task_id,
            new_value={"status": "failed", "error": str(e)},
            detail="手工执行后台任务失败",
        )
        raise HTTPException(500, f"任务执行失败: {str(e)}")


@router.get("/logs", response_model=ApiResponse)
async def get_task_logs(
    db: AsyncSession = Depends(get_db),
):
    """获取任务执行日志（最近50条）。"""
    try:
        from app.models.task_run import TaskRun
        from sqlalchemy import select, desc

        result = await db.execute(
            select(TaskRun).order_by(desc(TaskRun.started_at)).limit(50)
        )
        rows = list(result.scalars().all())
        logs = [{
            "id": r.id,
            "task_id": r.task_id,
            "task_name": r.task_name,
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "duration_ms": r.duration_ms,
            "error_message": r.error_message,
        } for r in rows]
        return ApiResponse(
            data={"logs": logs, "total": len(logs)},
            status="ready" if logs else "data_required",
            source_refs=[source_ref("task_run", item["id"], label=item["task_name"]) for item in logs],
            evidence_window="最近 50 条后台任务执行记录",
            confidence_reason="日志来自持久化 task_runs，未执行过的任务不生成成功记录。",
            data_gaps=[] if logs else ["暂无后台任务执行记录"],
        )
    except Exception as exc:
        logger.error("Task log query failed: %s", exc)
        raise HTTPException(500, "后台任务日志读取失败") from exc

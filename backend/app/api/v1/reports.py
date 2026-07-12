"""Reports API — real data aggregation with anomaly detection."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.report_subscription import ReportSubscription
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.report import ReportSubscriptionCreate, ReportSubscriptionResponse
from app.services import report_service
from app.services.audit_service import record_audit_event
from app.services.entitlement_service import require_entitlement
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily", response_model=ApiResponse)
async def daily_report(
    date: Optional[str] = Query(None, description="ISO date, e.g. 2026-05-31"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Daily performance report with real aggregation."""
    date_str = date or datetime.now().isoformat()[:10]
    report = await report_service.generate_daily_report(db, current_user.id, date_str)
    return _report_response(report)


@router.get("/weekly", response_model=ApiResponse)
async def weekly_report(
    week_start: Optional[str] = Query(None, description="ISO date, week start"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Weekly performance report."""
    ws = week_start or (datetime.now() - timedelta(days=7)).isoformat()[:10]
    report = await report_service.generate_weekly_report(db, current_user.id, ws)
    return _report_response(report)


@router.get("/monthly", response_model=ApiResponse)
async def monthly_report(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Monthly performance report."""
    m = month or datetime.now().isoformat()[:7]
    report = await report_service.generate_monthly_report(db, current_user.id, m)
    return _report_response(report)


@router.post("/anomaly/detect", response_model=ApiResponse)
async def detect_anomalies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run anomaly detection on today's data vs 7-day average."""
    anomalies = await report_service.detect_anomalies(db, current_user.id)
    return ApiResponse(data={
        "detected_at": datetime.now().isoformat(),
        "anomalies": anomalies,
        "total": len(anomalies),
    })


@router.post("/schedule", response_model=ApiResponse)
async def schedule_report(
    req: ReportSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Subscribe to periodic reports."""
    existing_subscriptions = await report_service.list_subscriptions(db, current_user.id)
    await require_entitlement(
        db,
        current_user,
        "report.subscriptions.max",
        len(existing_subscriptions) + 1,
    )
    try:
        sub = await report_service.create_subscription(
            db, current_user.id, req.channel, req.frequency,
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="report_subscription",
        resource_id=sub.id,
        new_value=_subscription_snapshot(sub),
        detail="创建报表订阅",
    )
    return ApiResponse(
        data=ReportSubscriptionResponse.model_validate(sub),
        status="ready",
        source_refs=[source_ref("report_subscription", sub.id, label=f"{sub.channel}:{sub.frequency}")],
        evidence_window="当前报表订阅配置",
        confidence_reason="订阅仅创建真实可执行的站内通知投递计划。",
        data_gaps=[],
    )


@router.get("/subscriptions", response_model=ApiResponse)
async def list_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List report subscriptions."""
    subs = await report_service.list_subscriptions(db, current_user.id)
    return ApiResponse(
        data=[ReportSubscriptionResponse.model_validate(s) for s in subs],
        status="ready" if subs else "data_required",
        source_refs=[source_ref("report_subscription", item.id, label=f"{item.channel}:{item.frequency}") for item in subs],
        evidence_window="当前用户报表订阅配置",
        confidence_reason="列表仅包含已持久化订阅；外部渠道未接入时不可创建。",
        data_gaps=[] if subs else ["暂无报表订阅"],
    )


@router.delete("/subscriptions/{sub_id}", response_model=ApiResponse)
async def delete_subscription(
    sub_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a report subscription."""
    sub = await _get_subscription(db, sub_id, current_user.id)
    if not sub:
        raise HTTPException(404, "订阅不存在")
    old_value = _subscription_snapshot(sub)
    ok = await report_service.delete_subscription(db, sub_id, current_user.id)
    if not ok:
        raise HTTPException(404, "订阅不存在")
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="report_subscription",
        resource_id=sub_id,
        old_value=old_value,
        detail="删除报表订阅",
    )
    return ApiResponse(data={"deleted": True})


@router.get("/summary", response_model=ApiResponse)
async def report_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Quick summary — today's revenue, week, month totals."""
    today = datetime.now().isoformat()[:10]
    today_rpt = await report_service.generate_daily_report(db, current_user.id, today)
    return ApiResponse(data={
        "today": today_rpt["summary"],
    })


async def _get_subscription(db: AsyncSession, sub_id: str, user_id: str) -> Optional[ReportSubscription]:
    result = await db.execute(
        select(ReportSubscription).where(
            ReportSubscription.id == sub_id,
            ReportSubscription.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def _subscription_snapshot(sub: ReportSubscription) -> dict:
    return {
        "id": sub.id,
        "channel": sub.channel,
        "frequency": sub.frequency,
        "enabled": sub.enabled,
    }


def _report_response(report: dict) -> ApiResponse:
    has_orders = report.get("summary", {}).get("total_orders", 0) > 0
    return ApiResponse(
        data=report,
        status="ready" if has_orders else "data_required",
        source_refs=report.get("source_refs", []),
        evidence_window=report.get("evidence_window"),
        confidence_reason=report.get("confidence_reason"),
        data_gaps=report.get("data_gaps", []),
    )

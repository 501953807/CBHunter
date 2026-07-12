"""Truthful report subscription delivery through supported channels."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report_subscription import ReportSubscription
from app.services.notification_service import create_notification
from app.services.report_service import (
    generate_daily_report,
    generate_monthly_report,
    generate_weekly_report,
)

logger = logging.getLogger(__name__)


def is_subscription_due(subscription: ReportSubscription, now: datetime) -> bool:
    """Return whether a subscription needs one delivery in the current period."""
    if not subscription.enabled or subscription.channel != "in_app":
        return False
    sent = subscription.last_sent_at
    if sent is None:
        return True
    if sent.tzinfo is None:
        sent = sent.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if subscription.frequency == "daily":
        return sent.date() != now.date()
    if subscription.frequency == "weekly":
        return (sent.isocalendar().year, sent.isocalendar().week) != (
            now.isocalendar().year, now.isocalendar().week
        )
    if subscription.frequency == "monthly":
        return (sent.year, sent.month) != (now.year, now.month)
    return False


async def dispatch_due_report_subscriptions(
    db: AsyncSession, now: Optional[datetime] = None
) -> dict:
    """Generate due reports and deliver them through the real in-app notification center."""
    current = now or datetime.now(timezone.utc)
    result = await db.execute(
        select(ReportSubscription).where(ReportSubscription.enabled == True)
    )
    subscriptions = list(result.scalars().all())
    delivered = 0
    skipped = 0
    errors = []

    for subscription in subscriptions:
        if not is_subscription_due(subscription, current):
            skipped += 1
            continue
        try:
            report, title = await _generate_subscription_report(db, subscription, current)
            summary = report["summary"]
            profit = summary.get("gross_profit")
            profit_text = "利润待补成本后计算" if profit is None else f"毛利润 ¥{profit:,.2f}"
            await create_notification(
                db,
                subscription.user_id,
                type="report",
                level="info",
                title=title,
                message=(
                    f"营收 ¥{summary['total_revenue']:,.2f}，"
                    f"订单 {summary['total_orders']} 单，{profit_text}。"
                ),
                link="/reports",
            )
            subscription.last_sent_at = current
            await db.commit()
            delivered += 1
        except Exception as exc:
            logger.error("Report subscription delivery failed for %s: %s", subscription.id, exc)
            errors.append({"subscription_id": subscription.id, "error": str(exc)})

    return {"delivered": delivered, "skipped": skipped, "errors": errors}


async def _generate_subscription_report(
    db: AsyncSession, subscription: ReportSubscription, current: datetime
) -> tuple[dict, str]:
    if subscription.frequency == "daily":
        label = current.date().isoformat()
        return await generate_daily_report(db, subscription.user_id, label), f"日报 {label}"
    if subscription.frequency == "weekly":
        week_start = (current - timedelta(days=current.weekday())).date().isoformat()
        return await generate_weekly_report(db, subscription.user_id, week_start), f"周报 {week_start}"
    month = current.strftime("%Y-%m")
    return await generate_monthly_report(db, subscription.user_id, month), f"月报 {month}"

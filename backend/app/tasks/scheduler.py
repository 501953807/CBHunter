import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _start_task_run(db, task_id: str, task_name: str):
    from app.models.task_run import TaskRun

    run = TaskRun(task_id=task_id, task_name=task_name, status="running")
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


async def _finish_task_run(db, run, status: str, error_message: str | None = None):
    now = datetime.now(timezone.utc)
    started_at = run.started_at
    if started_at and started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    run.status = status
    run.finished_at = now
    run.duration_ms = int((now - started_at).total_seconds() * 1000) if started_at else None
    run.error_message = error_message
    await db.commit()


async def sync_all_platforms_job():
    """Background job: sync orders for all active platform accounts."""
    from app.database import async_session
    from app.services.sync_service import SyncService

    async with async_session() as db:
        run = await _start_task_run(db, "sync_orders", "订单同步")
        try:
            service = SyncService(db)
            logs = await service.sync_all_platforms()
            if not logs:
                await _finish_task_run(db, run, "skipped", "无可同步的平台店铺：未配置店铺或 Open API 尚未就绪")
                return
            failed_logs = [log for log in logs if log.status in {"failed", "partial_failed"}]
            for log in logs:
                logger.info(f"Sync {log.sync_type} for {log.platform_account_id}: {log.status} "
                            f"({log.records_processed} processed)")
            status = "partial_failed" if failed_logs else "success"
            await _finish_task_run(
                db,
                run,
                status,
                f"{len(failed_logs)} 个平台账号同步存在失败" if failed_logs else None,
            )
        except Exception as exc:
            await _finish_task_run(db, run, "failed", str(exc))
            raise


def setup_scheduler():
    """Configure all recurring background jobs."""
    # Order sync: every 15 minutes
    scheduler.add_job(
        sync_all_platforms_job,
        IntervalTrigger(minutes=15),
        id="sync_orders",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    # Analytics snapshot: daily at 3 AM
    scheduler.add_job(
        daily_analytics_snapshot_job,
        CronTrigger(hour=3, minute=0),
        id="analytics_snapshot",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    # Trend fetch: every 24 hours
    scheduler.add_job(
        fetch_trends_job,
        IntervalTrigger(hours=24),
        id="fetch_trends",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    # Trending product sync: every 12 hours
    scheduler.add_job(
        sync_trending_job,
        IntervalTrigger(hours=12),
        id="sync_trending",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    scheduler.add_job(
        dispatch_report_subscriptions_job,
        IntervalTrigger(hours=1),
        id="dispatch_reports",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    logger.info("Scheduler configured with 5 jobs")


async def sync_trending_job():
    """Auto-sync trending products from all platforms (runs every 12h)."""
    from app.database import async_session
    from app.services.trending_sync_service import sync_trending_products

    async with async_session() as db:
        run = await _start_task_run(db, "sync_trending", "热卖商品同步")
        try:
            stats = await sync_trending_products(db)
            logger.info(f"Trending sync job completed: {stats}")
            await _finish_task_run(db, run, "success")
        except Exception as exc:
            await _finish_task_run(db, run, "failed", str(exc))
            raise


async def fetch_trends_job():
    """Fetch trends (Google + Pinterest) and cross-validate (runs every 24h)."""
    from app.database import async_session
    from app.services.trend_service import fetch_all_trends

    async with async_session() as db:
        run = await _start_task_run(db, "fetch_trends", "趋势采集")
        try:
            stats = await fetch_all_trends(db)
            logger.info(f"Trend fetch job complete: {stats}")
            await _finish_task_run(db, run, "success")
        except Exception as exc:
            await _finish_task_run(db, run, "failed", str(exc))
            raise


async def daily_analytics_snapshot_job():
    """Create daily analytics snapshots for all users."""
    from app.database import async_session
    from app.models.user import User
    from app.services.analytics_service import create_daily_snapshot
    from sqlalchemy import select

    async with async_session() as db:
        run = await _start_task_run(db, "analytics_snapshot", "数据快照")
        failed = 0
        try:
            result = await db.execute(select(User))
            users = list(result.scalars().all())
            for user in users:
                try:
                    await create_daily_snapshot(db, user.id)
                    logger.info(f"Analytics snapshot created for user {user.id}")
                except Exception as e:
                    failed += 1
                    logger.error(f"Failed to create snapshot for user {user.id}: {e}")
            await _finish_task_run(
                db,
                run,
                "partial_failed" if failed else "success",
                f"{failed} 个用户快照生成失败" if failed else None,
            )
        except Exception as exc:
            await _finish_task_run(db, run, "failed", str(exc))
            raise


async def dispatch_report_subscriptions_job():
    """Deliver due report subscriptions to the in-app notification center."""
    from app.database import async_session
    from app.services.report_delivery_service import dispatch_due_report_subscriptions

    async with async_session() as db:
        run = await _start_task_run(db, "dispatch_reports", "报表订阅投递")
        try:
            result = await dispatch_due_report_subscriptions(db)
            logger.info("Report subscriptions dispatched: %s", result)
            await _finish_task_run(db, run, "success")
        except Exception as exc:
            await _finish_task_run(db, run, "failed", str(exc))
            raise

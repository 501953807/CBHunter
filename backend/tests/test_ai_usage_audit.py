"""AI task audit and quota governance regression tests."""

import asyncio
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.audit_log import AuditLog
from app.models.billing import PlanEntitlement, QuotaUsage, SubscriptionPlan
from app.models.user import User
from app.services.ai_usage_audit_service import execute_governed_ai_task
from app.services.task_executor import TaskResult


async def _seed_user_and_plan(session):
    user = User(id="ai-user", username="admin", email="admin@example.com", hashed_password="x")
    session.add_all([
        user,
        SubscriptionPlan(
            code="free",
            name="免费版",
            description="测试套餐",
            price_cents=0,
            currency="CNY",
            billing_cycle="month",
            is_active=True,
            metadata_json={},
        ),
        PlanEntitlement(
            plan_code="free",
            feature_code="ai.tasks.monthly",
            feature_name="AI 月度任务",
            enabled=True,
            limit_value=10,
            unit="times/month",
            metadata_json={},
        ),
    ])
    await session.commit()
    return user


async def _audit_payload(session):
    result = await session.execute(select(AuditLog).where(AuditLog.action == "ai_task_execute"))
    audit = result.scalar_one()
    return audit, json.loads(audit.new_value)


def test_successful_ai_task_is_audited_and_consumes_quota(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'ai-success.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = await _seed_user_and_plan(session)

            async def executor(*_args, **_kwargs):
                return TaskResult(True, {"text": "生成内容"}, provider="gemini", confidence="high")

            result = await execute_governed_ai_task(
                session,
                user,
                "listing_copy",
                {"product_name": "编织包"},
                object_type="sourcing_item",
                object_id="item-1",
                source="content_factory",
                executor=executor,
            )
            usage = (await session.execute(select(QuotaUsage))).scalar_one()
            audit, payload = await _audit_payload(session)
        await engine.dispose()

        assert result.success is True
        assert usage.feature_code == "ai.tasks.monthly"
        assert usage.used_value == 1
        assert audit.resource_type == "ai_task"
        assert audit.resource_id == "item-1"
        assert payload["task_type"] == "listing_copy"
        assert payload["object_type"] == "sourcing_item"
        assert payload["provider"] == "gemini"
        assert payload["status"] == "success"
        assert payload["quota_charged"] is True
        assert payload["duration_ms"] >= 0

    asyncio.run(run_test())


def test_failed_ai_task_is_audited_without_consuming_quota(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'ai-failed.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = await _seed_user_and_plan(session)

            async def executor(*_args, **_kwargs):
                return TaskResult(False, error="provider timeout")

            result = await execute_governed_ai_task(
                session,
                user,
                "video_script",
                {"product_name": "收纳包"},
                object_id="item-2",
                source="content_factory",
                executor=executor,
            )
            usage = (await session.execute(select(QuotaUsage))).scalar_one_or_none()
            audit, payload = await _audit_payload(session)
        await engine.dispose()

        assert result.success is False
        assert usage is None
        assert audit.resource_id == "item-2"
        assert payload["task_type"] == "video_script"
        assert payload["status"] == "failed"
        assert payload["error"] == "provider timeout"
        assert payload["quota_charged"] is False

    asyncio.run(run_test())


def test_empty_ai_task_result_is_audited_without_consuming_quota(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'ai-empty.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = await _seed_user_and_plan(session)

            async def executor(*_args, **_kwargs):
                return TaskResult(True, {}, provider="gemini", confidence="medium")

            result = await execute_governed_ai_task(
                session,
                user,
                "decision_analysis",
                {"product_name": "空结果商品"},
                object_id="item-3",
                source="selection_decision",
                executor=executor,
            )
            usage = (await session.execute(select(QuotaUsage))).scalar_one_or_none()
            _audit, payload = await _audit_payload(session)
        await engine.dispose()

        assert result.success is True
        assert usage is None
        assert payload["task_type"] == "decision_analysis"
        assert payload["status"] == "empty"
        assert payload["quota_charged"] is False

    asyncio.run(run_test())

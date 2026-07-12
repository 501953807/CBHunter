"""Tests for independent operating records and automatic finance posting."""

import asyncio
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.operation_record import OperationRecord
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.sys_dict import SysDictItem
from app.services.operation_service import create_product_diagnostic_action, create_record, get_product_operation_metrics, update_record
from app.schemas.operations import OperationRecordCreate


def test_operation_create_requires_counterparty_and_positive_plan():
    with pytest.raises(ValidationError):
        OperationRecordCreate(record_type="ad_campaign", status="operation_active", name="仅有名称")


def test_operation_record_posts_and_updates_real_amount(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'operations.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            session.add_all([
                SysDictItem(id="ad_campaign", type="operation_record_type", label="广告投放", extra={"ledger_entry_type": "advertising_cost"}),
                SysDictItem(id="operation_active", type="operation_record_status", label="进行中"),
            ])
            await session.commit()
            record = await create_record(session, "user-a", {
                "record_type": "ad_campaign",
                "status": "operation_active",
                "name": "真实广告计划",
                "counterparty": "真实广告服务商",
                "planned_amount_rmb": 200,
                "actual_amount_rmb": 128.5,
                "currency": "CNY",
                "metrics": {},
                "extra": {},
            })
            ledger_id = record.ledger_entry_id
            await update_record(session, "user-a", record.id, {"actual_amount_rmb": 180})
            ledger = (await session.execute(select(FinanceLedgerEntry).where(FinanceLedgerEntry.id == ledger_id))).scalar_one()

        await engine.dispose()
        assert ledger.entry_type == "advertising_cost"
        assert ledger.amount_rmb == 180
        assert ledger.extra["operation_record_id"] == record.id

    asyncio.run(run_test())


def test_operation_record_rejects_obvious_temporary_or_test_names(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'operation-name-quality.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            session.add_all([
                SysDictItem(id="ad_campaign", type="operation_record_type", label="广告投放", extra={"ledger_entry_type": "advertising_cost"}),
                SysDictItem(id="operation_active", type="operation_record_status", label="进行中"),
            ])
            await session.commit()
            payload = {
                "record_type": "ad_campaign",
                "status": "operation_active",
                "name": "真实广告计划",
                "counterparty": "真实广告服务商",
                "planned_amount_rmb": 200,
                "actual_amount_rmb": 128.5,
                "currency": "CNY",
                "metrics": {},
                "extra": {},
            }
            with pytest.raises(HTTPException) as create_error:
                await create_record(session, "user-a", {**payload, "name": "修改后的运营记录名称"})
            record = await create_record(session, "user-a", payload)
            with pytest.raises(HTTPException) as update_error:
                await update_record(session, "user-a", record.id, {"name": "仅名称无其他必填-测试"})

        await engine.dispose()
        assert "临时编辑或测试残留" in create_error.value.detail
        assert "临时编辑或测试残留" in update_error.value.detail

    asyncio.run(run_test())


def test_product_operation_metrics_expose_listing_diagnostics_and_actions(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-operation-metrics.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            account = PlatformAccount(user_id="ops-user", platform="tiktok", account_name="TikTok PH 店铺")
            product = Product(user_id="ops-user", sku="SKU-OPS", name="手机支架")
            session.add_all([account, product])
            await session.flush()
            session.add(PlatformListing(
                user_id="ops-user",
                product_id=product.id,
                platform_account_id=account.id,
                title="手机支架 TikTok Listing",
                price=129,
                stock=3,
                status="active",
                performance={
                    "impressions_30d": 1200,
                    "views_30d": 240,
                    "orders_30d": 0,
                    "sales_amount_30d": 0,
                    "favorites_30d": 18,
                    "rating": 4.7,
                    "reviews_30d": 3,
                },
            ))
            await session.commit()
            result = await get_product_operation_metrics(session, "ops-user")

        await engine.dispose()
        item = result["items"][0]
        assert result["summary"]["listing_count"] == 1
        assert item["product_name"] == "手机支架"
        assert item["metrics"]["impressions_30d"] == 1200
        assert item["metrics"]["views_30d"] == 240
        assert item["metrics"]["conversion_rate_pct"] == 0
        assert any(diag["code"] == "traffic_no_order" for diag in item["diagnostics"])
        assert any(action["route"] == f"/content?product_id={product.id}" for action in item["growth_actions"])
        assert result["source_refs"][0]["type"] == "platform_listing"

    asyncio.run(run_test())


def test_product_diagnostic_action_creates_zero_budget_operation_record(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-operation-action.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            session.add_all([
                SysDictItem(id="listing_optimization", type="operation_record_type", label="Listing 优化"),
                SysDictItem(id="operation_pending", type="operation_record_status", label="待开始"),
            ])
            account = PlatformAccount(user_id="ops-user", platform="shopee", account_name="Shopee MY 店铺")
            product = Product(user_id="ops-user", sku="SKU-ACTION", name="收纳包")
            session.add_all([account, product])
            await session.flush()
            listing = PlatformListing(
                user_id="ops-user",
                product_id=product.id,
                platform_account_id=account.id,
                title="收纳包 Shopee Listing",
                price=22,
                stock=12,
                status="active",
                performance={"views_30d": 300, "orders_30d": 0},
            )
            session.add(listing)
            await session.commit()
            record = await create_product_diagnostic_action(session, "ops-user", listing.id, "traffic_no_order")

        await engine.dispose()
        assert record.record_type == "listing_optimization"
        assert record.status == "operation_pending"
        assert record.planned_amount_rmb == 0
        assert record.ledger_entry_id is None
        assert record.extra["listing_id"] == listing.id
        assert record.metrics["diagnostic_code"] == "traffic_no_order"

    asyncio.run(run_test())


def test_product_operation_metrics_include_latest_operation_review_feedback(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-operation-feedback.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            account = PlatformAccount(user_id="ops-user", platform="shopee", account_name="Shopee MY 店铺")
            product = Product(user_id="ops-user", sku="SKU-FEEDBACK", name="桌面收纳盒")
            session.add_all([account, product])
            await session.flush()
            listing = PlatformListing(
                user_id="ops-user",
                product_id=product.id,
                platform_account_id=account.id,
                title="桌面收纳盒 Shopee Listing",
                price=45,
                stock=20,
                status="active",
                performance={"impressions_30d": 1800, "views_30d": 320, "orders_30d": 8, "sales_amount_30d": 360},
            )
            session.add(listing)
            await session.flush()
            session.add(OperationRecord(
                user_id="ops-user",
                record_type="listing_optimization",
                status="operation_completed",
                name="Listing优化：桌面收纳盒 - 主图复盘",
                platform="shopee",
                market="MY",
                counterparty="Shopee MY 店铺",
                planned_amount_rmb=0,
                actual_amount_rmb=0,
                currency="CNY",
                notes="主图已替换为真实场景图，标题补充材质和规格。",
                metrics={
                    "diagnostic_code": "low_conversion",
                    "review_result": "转化率由 1.6% 提升至 2.5%",
                    "before_conversion_rate_pct": 1.6,
                    "after_conversion_rate_pct": 2.5,
                },
                extra={
                    "source": "product_operation_metric",
                    "listing_id": listing.id,
                    "product_id": product.id,
                    "platform_account_id": account.id,
                    "effect_summary": "复盘有效，可沉淀为同类收纳商品 Listing 模板。",
                },
            ))
            await session.commit()
            result = await get_product_operation_metrics(session, "ops-user")

        await engine.dispose()
        item = result["items"][0]
        assert result["summary"]["reviewed_action_count"] == 1
        assert result["summary"]["pending_action_count"] == 0
        assert item["operation_feedback"]["has_review"] is True
        assert item["operation_feedback"]["record_name"] == "Listing优化：桌面收纳盒 - 主图复盘"
        assert item["operation_feedback"]["review_result"] == "转化率由 1.6% 提升至 2.5%"
        assert item["operation_feedback"]["effect_summary"] == "复盘有效，可沉淀为同类收纳商品 Listing 模板。"

    asyncio.run(run_test())

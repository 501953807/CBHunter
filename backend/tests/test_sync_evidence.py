"""Sync API evidence-chain regression tests."""

import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import sync as sync_api
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.platform_account import PlatformAccount
from app.models.sync_log import SyncLog
from app.models.user import User


def test_trigger_sync_without_accounts_promotes_data_required_to_api_response(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sync-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="sync-user", username="sync", email="sync@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            response = await sync_api.trigger_sync(platform_account_id=None, current_user=user, db=session)

        await engine.dispose()

        assert response.status == "data_required"
        assert response.evidence_window == "当前用户平台账号配置"
        assert response.data_gaps == ["platform_accounts"]
        assert response.data["status"] == "data_required"

    asyncio.run(run_test())


def test_product_sync_blocked_response_explains_connector_gap(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-sync-gap.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="sync-user", username="sync", email="sync@example.com", hashed_password="x")
            account = PlatformAccount(
                user_id=user.id,
                platform="shopee",
                account_name="Shopee 主店",
                shop_id="shop-1",
                api_key_encrypted="encrypted-key",
                api_secret_encrypted="encrypted-secret",
                is_active=True,
            )
            session.add_all([user, account])
            await session.commit()

            with pytest.raises(HTTPException) as exc:
                await sync_api.trigger_product_sync(platform_account_id=account.id, current_user=user, db=session)
            await session.refresh(account)
            sync_log = (await session.execute(select(SyncLog).where(SyncLog.platform_account_id == account.id))).scalar_one()

        await engine.dispose()

        detail = exc.value.detail
        assert exc.value.status_code == 409
        assert detail["status"] == "configuration_required"
        assert detail["connector"]["account_id"] == account.id
        assert detail["connector"]["operation_details"]
        assert detail["next_action"]
        assert detail["data_gaps"]
        assert sync_log.status == "failed"
        assert sync_log.sync_type == "products"
        assert sync_log.error_details[0]["reason"] == "connector_not_ready"
        assert account.settings["sync_state"]["products"]["status"] == "failed"
        assert account.settings["sync_state"]["products"]["error_message"] == detail["message"]

    asyncio.run(run_test())


def test_bulk_product_sync_blocked_writes_log_for_each_store(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'bulk-product-sync-gap.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="sync-user", username="sync", email="sync@example.com", hashed_password="x")
            accounts = [
                PlatformAccount(
                    user_id=user.id,
                    platform="shopee",
                    account_name="Shopee A店",
                    shop_id="shop-a",
                    api_key_encrypted="encrypted-key",
                    api_secret_encrypted="encrypted-secret",
                    is_active=True,
                ),
                PlatformAccount(
                    user_id=user.id,
                    platform="tiktok",
                    account_name="TikTok B店",
                    shop_id="shop-b",
                    api_key_encrypted="encrypted-key",
                    api_secret_encrypted="encrypted-secret",
                    is_active=True,
                ),
            ]
            session.add_all([user, *accounts])
            await session.commit()

            with pytest.raises(HTTPException) as exc:
                await sync_api.trigger_product_sync(platform_account_id=None, current_user=user, db=session)
            for account in accounts:
                await session.refresh(account)
            logs = list((await session.execute(select(SyncLog).order_by(SyncLog.platform_account_id))).scalars().all())

        await engine.dispose()

        detail = exc.value.detail
        assert exc.value.status_code == 409
        assert len(detail["accounts"]) == 2
        assert len(logs) == 2
        assert {log.platform_account_id for log in logs} == {account.id for account in accounts}
        assert all(log.status == "failed" and log.sync_type == "products" for log in logs)
        assert all(log.error_details[0]["reason"] == "connector_not_ready" for log in logs)
        assert all(account.settings["sync_state"]["products"]["status"] == "failed" for account in accounts)

    asyncio.run(run_test())


def test_sync_logs_filter_products_and_expose_retry_details(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sync-logs-products.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="sync-user", username="sync", email="sync@example.com", hashed_password="x")
            account = PlatformAccount(user_id=user.id, platform="shopee", account_name="Shopee 主店", is_active=True)
            session.add_all([user, account])
            await session.flush()
            session.add_all([
                SyncLog(
                    user_id=user.id,
                    platform_account_id=account.id,
                    sync_type="products",
                    status="failed",
                    started_at=datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc),
                    records_processed=2,
                    records_failed=1,
                    error_message="商品字段映射失败",
                    error_details=[{"field": "category", "reason": "missing"}],
                ),
                SyncLog(
                    user_id=user.id,
                    platform_account_id=account.id,
                    sync_type="orders",
                    status="success",
                    started_at=datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc),
                    records_processed=1,
                ),
            ])
            await session.commit()

            response = await sync_api.sync_logs(
                platform_account_id=account.id,
                sync_type="products",
                page=1,
                page_size=20,
                current_user=user,
                db=session,
            )

        await engine.dispose()

        assert response.status == "ready"
        assert len(response.data) == 1
        assert response.data[0]["sync_type"] == "products"
        assert response.data[0]["error_details"][0]["field"] == "category"
        assert response.data[0]["retry_action"].startswith("修正商品接口凭证")
        assert response.data_gaps == ["当前页共有 1 条记录同步失败"]

    asyncio.run(run_test())


def test_bulk_order_sync_blocked_writes_log_for_each_store(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'bulk-order-sync-gap.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="sync-user", username="sync", email="sync@example.com", hashed_password="x")
            accounts = [
                PlatformAccount(
                    user_id=user.id,
                    platform="shopee",
                    account_name="Shopee A店",
                    shop_id="shop-a",
                    api_key_encrypted="encrypted-key",
                    api_secret_encrypted="encrypted-secret",
                    is_active=True,
                ),
                PlatformAccount(
                    user_id=user.id,
                    platform="temu",
                    account_name="TEMU C店",
                    shop_id="shop-c",
                    api_key_encrypted="encrypted-key",
                    api_secret_encrypted="encrypted-secret",
                    is_active=True,
                ),
            ]
            session.add_all([user, *accounts])
            await session.commit()

            with pytest.raises(HTTPException) as exc:
                await sync_api.trigger_sync(platform_account_id=None, current_user=user, db=session)
            for account in accounts:
                await session.refresh(account)
            logs = list((await session.execute(select(SyncLog).order_by(SyncLog.platform_account_id))).scalars().all())

        await engine.dispose()

        assert exc.value.status_code == 409
        assert len(logs) == 2
        assert all(log.status == "failed" and log.sync_type == "orders" for log in logs)
        assert all(log.error_details[0]["reason"] == "connector_not_ready" for log in logs)
        assert all(account.settings["sync_state"]["orders"]["status"] == "failed" for account in accounts)

    asyncio.run(run_test())

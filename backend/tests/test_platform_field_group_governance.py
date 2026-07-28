"""Tests for platform product field group Schema version governance."""

import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.services.config_service import (
    get_platform_product_field_group_versions,
    get_platform_product_field_groups,
    publish_platform_product_field_group_draft,
    save_platform_product_field_group_draft,
)


def test_platform_field_group_draft_does_not_affect_runtime_config(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'platform-field-groups-draft.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            runtime_before = await get_platform_product_field_groups(session)
            draft = await save_platform_product_field_group_draft(
                session,
                {
                    "shopee": {
                        "groups": [
                            {
                                "id": "basic",
                                "label": "基础信息",
                                "fields": [{"key": "product_title", "label": "商品标题", "required": True}],
                            }
                        ],
                    }
                },
                updated_by="admin",
                change_note="测试平台字段组草稿",
            )
            runtime_after = await get_platform_product_field_groups(session)
            versions = await get_platform_product_field_group_versions(session)
        await engine.dispose()

        assert draft["status"] == "draft"
        assert draft["updated_by"] == "admin"
        assert runtime_before["shopee"]["groups"][0]["fields"] != [{"key": "product_title", "label": "商品标题", "required": True}]
        assert runtime_after == runtime_before
        assert versions["draft"]["version"] == draft["version"]

    asyncio.run(run_test())


def test_platform_field_group_publish_activates_draft_without_runtime_metadata(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'platform-field-groups-publish.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            draft = await save_platform_product_field_group_draft(
                session,
                {
                    "shopee": {
                        "groups": [
                            {
                                "id": "basic",
                                "label": "基础信息",
                                "fields": [{"key": "product_title", "label": "商品标题", "required": True}],
                            }
                        ],
                    }
                },
                updated_by="admin",
                change_note="发布测试平台字段组",
            )
            active = await publish_platform_product_field_group_draft(
                session,
                published_by="admin",
                expected_version=draft["version"],
            )
            runtime = await get_platform_product_field_groups(session)
            versions = await get_platform_product_field_group_versions(session)
        await engine.dispose()

        assert active["status"] == "active"
        assert active["version"] == draft["version"]
        assert runtime["shopee"]["groups"][0]["fields"][0]["key"] == "product_title"
        assert "version" not in runtime
        assert "status" not in runtime
        assert not versions["draft"]
        assert versions["history"][0]["platform_count"] == 3

    asyncio.run(run_test())


def test_platform_field_group_draft_rejects_duplicate_field_keys(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'platform-field-groups-duplicate.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            with pytest.raises(ValueError, match="key 重复"):
                await save_platform_product_field_group_draft(
                    session,
                    {
                        "temu": {
                            "groups": [
                                {
                                    "id": "basic",
                                    "label": "基础信息",
                                    "fields": [
                                        {"key": "product_title", "label": "商品标题"},
                                        {"key": "product_title", "label": "重复商品标题"},
                                    ],
                                }
                            ],
                        }
                    },
                    updated_by="admin",
                )
        await engine.dispose()

    asyncio.run(run_test())

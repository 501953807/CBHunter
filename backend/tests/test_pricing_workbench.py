"""Pricing workbench regression tests."""

import asyncio
import json
from datetime import datetime, timezone
from types import SimpleNamespace

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.api.v1 import pricing as pricing_api
from app.api.v1.pricing import recommend_price
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.competitor_product import CompetitorProduct
from app.models.exchange_rate import ExchangeRate
from app.models.fee_template import FeeTemplate
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.sourcing_item import SourcingItem
from app.models.sys_dict import SysDictItem
from app.services.content_workbench_service import REQUIRED_CONTENT_GAPS


def test_pricing_bound_to_product_requires_confirmed_content(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'pricing-content-gate.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            item = SourcingItem(
                user_id="pricing-user",
                product_name="越南风编织包",
                source_name="1688",
                source_price_rmb=18,
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
            )
            session.add_all([
                item,
                FeeTemplate(
                    platform="shopee",
                    market="MY",
                    commission_pct=8,
                    transaction_fee_pct=2,
                    tech_service_pct=1,
                    is_active=True,
                ),
                ExchangeRate(from_currency="CNY", to_currency="MYR", rate=0.65, source="test"),
                SysDictItem(
                    id="MY",
                    type="market",
                    label="马来西亚",
                    extra={"currency": "MYR"},
                    is_active=True,
                ),
            ])
            await session.commit()
            await session.refresh(item)

            result = await recommend_price(
                {
                    "content_item_id": item.id,
                    "target_profit_pct": 20,
                    "pricing_mode": "cost_based",
                },
                session,
                SimpleNamespace(id="pricing-user"),
            )
        await engine.dispose()

        assert result.status == "data_required"
        assert result.data["recommendations"] == {}
        assert "content_tasks.confirmed" in result.data["data_gaps"]
        assert "内容任务尚未全部人工确认" in result.data["note"]

    asyncio.run(run_test())


def test_pricing_bound_to_ready_product_uses_cost_fee_and_exchange(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'pricing-ready-product.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            item = SourcingItem(
                user_id="pricing-user",
                product_name="越南风编织包",
                source_name="1688",
                source_price_rmb=18,
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
                extra_data={
                    "content_tasks": {
                        task_type: {
                            "confirmed_version": 1,
                            "versions": [{"version": 1, "content": "已确认内容", "provider": "manual"}],
                        }
                        for task_type, _label in REQUIRED_CONTENT_GAPS
                    }
                },
            )
            session.add_all([
                item,
                FeeTemplate(
                    platform="shopee",
                    market="MY",
                    commission_pct=8,
                    transaction_fee_pct=2,
                    tech_service_pct=1,
                    is_active=True,
                ),
                ExchangeRate(from_currency="CNY", to_currency="MYR", rate=0.65, source="test"),
                SysDictItem(
                    id="MY",
                    type="market",
                    label="马来西亚",
                    extra={"currency": "MYR"},
                    is_active=True,
                ),
            ])
            await session.commit()
            await session.refresh(item)

            result = await recommend_price(
                {
                    "content_item_id": item.id,
                    "target_profit_pct": 20,
                    "pricing_mode": "cost_based",
                },
                session,
                SimpleNamespace(id="pricing-user"),
            )
        await engine.dispose()

        balanced = result.data["recommendations"]["balanced"]
        assert result.status == "ready"
        assert result.data["product_name"] == "越南风编织包"
        assert result.data["source_price_rmb"] == 18
        assert result.data["platform"] == "shopee"
        assert result.data["market"] == "MY"
        assert result.data["currency"] == "MYR"
        assert balanced["selling_price"] == 26.29
        assert balanced["selling_price_local"] == 17.09
        assert len(result.source_refs) == 4

    asyncio.run(run_test())


def test_pricing_bound_product_returns_competitor_price_band(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'pricing-competitors.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            item = SourcingItem(
                user_id="pricing-user",
                product_name="编织包",
                source_name="1688",
                source_price_rmb=18,
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
                extra_data={
                    "content_tasks": {
                        task_type: {
                            "confirmed_version": 1,
                            "versions": [{"version": 1, "content": "已确认内容", "provider": "manual"}],
                        }
                        for task_type, _label in REQUIRED_CONTENT_GAPS
                    }
                },
            )
            captured_at = datetime.now(timezone.utc)
            session.add_all([
                item,
                FeeTemplate(platform="shopee", market="MY", commission_pct=8, transaction_fee_pct=2, tech_service_pct=1, is_active=True),
                ExchangeRate(from_currency="CNY", to_currency="MYR", rate=0.65, source="test"),
                SysDictItem(id="MY", type="market", label="马来西亚", extra={"currency": "MYR"}, is_active=True),
                CompetitorProduct(user_id="pricing-user", platform="shopee", market="MY", currency="MYR", name="竞品A 编织包", price=16, is_tracked=True, last_updated=captured_at),
                CompetitorProduct(user_id="pricing-user", platform="shopee", market="MY", currency="MYR", name="竞品B 编织包", price=18, is_tracked=True, last_updated=captured_at),
                CompetitorProduct(user_id="pricing-user", platform="shopee", market="MY", currency="MYR", name="竞品C 编织包", price=21, is_tracked=True, last_updated=captured_at),
                CompetitorProduct(user_id="pricing-user", platform="tiktok", market="MY", currency="MYR", name="其他平台", price=9, is_tracked=True, last_updated=captured_at),
            ])
            await session.commit()
            await session.refresh(item)

            result = await recommend_price(
                {"content_item_id": item.id, "target_profit_pct": 20, "pricing_mode": "cost_based"},
                session,
                SimpleNamespace(id="pricing-user"),
            )
        await engine.dispose()

        band = result.data["competitor_price_band"]
        balanced = result.data["recommendations"]["balanced"]
        assert band == {"currency": "MYR", "sample_count": 3, "min": 16.0, "median": 18.0, "max": 21.0}
        assert balanced["competition_position"] == "inside_band"
        assert "competitor_products.price_band" not in result.data.get("data_gaps", [])

    asyncio.run(run_test())


def test_pricing_workbench_lists_only_content_ready_products(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'pricing-workbench.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            ready = SourcingItem(
                user_id="pricing-user",
                product_name="已完成内容商品",
                source_name="1688",
                source_url="https://detail.1688.com/offer/1037742050290.html",
                source_price_rmb=18,
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
                source_image="https://cbu01.alicdn.com/img/ibank/O1CN01pnIXqh1QTW9XzqJRx_!!2864051977-0-cib.jpg_.webp",
                    extra_data={
                        "platform_requirements": {
                            "shopee": {
                            "required_attributes": ["类目", "品牌/No Brand", "材质", "重量"],
                            "media": ["主图", "场景图"],
                            "content": ["标题关键词", "商品描述"],
                                "compliance": ["禁限售复核"],
                            }
                        },
                        "media_readiness": {
                            "captured_image_count": 1,
                            "missing_image_count": 4,
                            "gaps": ["缺少平台辅图", "缺少尺寸/规格图"],
                        },
                        "content_tasks": {
                        task_type: {
                            "confirmed_version": 1,
                            "versions": [{"version": 1, "content": "已确认内容", "provider": "manual"}],
                        }
                        for task_type, _label in REQUIRED_CONTENT_GAPS
                    }
                },
            )
            ready.extra_data["content_tasks"]["listing_store_override"] = {
                "confirmed_version": 1,
                "versions": [{
                    "version": 1,
                    "content": json.dumps({
                        "schema": "listing_store_override.v1",
                        "store_id": "store-shopee-my",
                        "store_label": "Shopee MY 主店",
                        "title": "Shopee 店铺专用编织包标题",
                        "price": "17.09",
                        "currency": "MYR",
                        "image_urls": ["https://img.example.com/main.jpg", "https://img.example.com/detail.jpg"],
                        "skus": [{"seller_sku": "BAG-MY-001", "price": "17.09"}],
                        "logistics_note": "500g，20x15x8cm",
                        "compliance_note": "无品牌授权风险",
                    }, ensure_ascii=False),
                    "provider": "manual",
                }],
            }
            blocked = SourcingItem(
                user_id="pricing-user",
                product_name="内容未完成商品",
                source_name="1688",
                source_price_rmb=20,
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
            )
            session.add_all([ready, blocked])
            await session.commit()

            response = await pricing_api.get_pricing_workbench(
                current_user=SimpleNamespace(id="pricing-user", is_admin=False),
                db=session,
            )
        await engine.dispose()

        assert response.status == "ready"
        assert response.data["metrics"] == {"total": 1}
        assert response.data["items"][0]["id"] == ready.id
        assert response.data["items"][0]["product_name"] == "已完成内容商品"
        assert response.data["items"][0]["pricing_status"] == "pricing_required"
        assert response.data["items"][0]["work_item_id"] == f"sourcing_item:{ready.id}"
        assert response.data["items"][0]["object_refs"] == [
            {"type": "sourcing_item", "id": ready.id, "label": "已完成内容商品"}
        ]
        assert response.data["items"][0]["lifecycle_status"] == "pricing_required"
        assert response.data["items"][0]["lifecycle_label"] == "待定价校验"
        assert response.data["items"][0]["evidence_completeness"]["content"] == "present"
        assert response.data["items"][0]["evidence_summary"]["total"] == 8
        assert response.data["items"][0]["image_url"].startswith("https://cbu01.alicdn.com/")
        assert response.data["items"][0]["source_url"] == "https://detail.1688.com/offer/1037742050290.html"
        required_attributes = set(response.data["items"][0]["platform_requirements"]["required_attributes"])
        assert {"类目", "品牌/No Brand", "材质", "重量"}.issubset(required_attributes)
        assert {"category", "brand", "seller_sku"}.issubset(required_attributes)
        assert response.data["items"][0]["media_readiness"]["captured_image_count"] == 1
        assert response.data["items"][0]["media_readiness"]["missing_image_count"] == 4
        assert "缺少尺寸/规格图" in response.data["items"][0]["media_readiness"]["gaps"]
        assert response.data["items"][0]["pricing_inputs"] == {
            "cost_rmb": 18,
            "target_platform": "shopee",
            "target_market": "MY",
            "content_confirmed": True,
        }
        assert response.data["items"][0]["listing_store_override"]["store_label"] == "Shopee MY 主店"
        assert response.data["items"][0]["listing_store_override"]["title"] == "Shopee 店铺专用编织包标题"
        assert response.data["items"][0]["listing_store_override"]["image_count"] == 2
        assert response.data["items"][0]["listing_store_override"]["sku_count"] == 1
        assert response.data["items"][0]["listing_store_override"]["has_logistics"] is True
        assert response.data["items"][0]["listing_store_override"]["has_compliance"] is True

    asyncio.run(run_test())


def test_pricing_workbench_exposes_matching_store_options(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'pricing-stores.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            ready = SourcingItem(
                user_id="pricing-user",
                product_name="多店铺定价商品",
                source_name="1688",
                source_price_rmb=18,
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
                extra_data={
                    "content_tasks": {
                        task_type: {
                            "confirmed_version": 1,
                            "versions": [{"version": 1, "content": "已确认内容", "provider": "manual"}],
                        }
                        for task_type, _label in REQUIRED_CONTENT_GAPS
                    }
                },
            )
            shopee_store = PlatformAccount(
                user_id="pricing-user",
                platform="shopee",
                account_name="Shopee MY 主店",
                is_active=True,
            )
            tiktok_store = PlatformAccount(
                user_id="pricing-user",
                platform="tiktok",
                account_name="TikTok MY",
                is_active=True,
            )
            session.add_all([ready, shopee_store, tiktok_store])
            await session.commit()

            response = await pricing_api.get_pricing_workbench(
                current_user=SimpleNamespace(id="pricing-user", is_admin=False),
                db=session,
            )
        await engine.dispose()

        stores = response.data["items"][0]["store_options"]
        assert stores == [{
            "id": shopee_store.id,
            "platform": "shopee",
            "account_name": "Shopee MY 主店",
            "shop_id": None,
        }]

    asyncio.run(run_test())


def test_confirm_pricing_creates_local_listing_draft(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'pricing-confirm.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            account = PlatformAccount(
                user_id="pricing-user",
                platform="shopee",
                account_name="Shopee MY",
                is_active=True,
            )
            item = SourcingItem(
                user_id="pricing-user",
                product_name="越南风编织包",
                source_name="1688",
                source_price_rmb=18,
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
                extra_data={
                    "content_tasks": {
                        task_type: {
                            "confirmed_version": 1,
                            "versions": [{
                                "version": 1,
                                "content": "越南风编织包 轻便通勤\n第二行标题",
                                "provider": "manual",
                            }],
                        }
                        for task_type, _label in REQUIRED_CONTENT_GAPS
                    }
                },
            )
            item.extra_data["content_tasks"]["description"]["versions"][0]["content"] = "适合通勤和海岛旅行的大容量编织包。"
            item.extra_data["content_tasks"]["listing_store_override"] = {
                "confirmed_version": 1,
                "versions": [{
                    "version": 1,
                    "content": json.dumps({
                        "schema": "listing_store_override.v1",
                        "store_id": account.id,
                        "store_label": "Shopee MY",
                        "title": "Shopee 店铺覆盖标题",
                        "image_urls": ["https://img.example.com/main.jpg", "https://img.example.com/scene.jpg"],
                        "skus": [{"seller_sku": "BAG-MY-001", "price": "17.09"}],
                    }, ensure_ascii=False),
                    "provider": "manual",
                }],
            }
            session.add_all([account, item])
            await session.commit()
            await session.refresh(item)

            response = await pricing_api.confirm_pricing(
                {
                    "content_item_id": item.id,
                    "selling_price_rmb": 26.29,
                    "selling_price_local": 17.09,
                    "currency": "MYR",
                    "pricing_tier": "balanced",
                    "pricing_mode": "cost_based",
                    "target_profit_pct": 30,
                },
                current_user=SimpleNamespace(id="pricing-user", is_admin=False),
                db=session,
            )
            product = (await session.execute(select(Product))).scalar_one()
            listing = (await session.execute(select(PlatformListing))).scalar_one()
            await session.refresh(item)
        await engine.dispose()

        assert response.status == "ready"
        assert response.data["status"] == "price_confirmed"
        assert response.data["listing_id"] == listing.id
        assert item.pipeline_stage == "price_confirmed"
        assert item.selling_price_local == 17.09
        assert item.extra_data["pricing_confirmation"]["selling_price_local"] == 17.09
        assert product.name == "越南风编织包"
        assert product.cost_price == 18
        assert listing.status == "draft"
        assert listing.price == 17.09
        assert listing.title == "Shopee 店铺覆盖标题"
        assert listing.description == "适合通勤和海岛旅行的大容量编织包。"
        assert listing.images == ["https://img.example.com/main.jpg", "https://img.example.com/scene.jpg"]
        assert listing.platform_account_id == account.id
        assert listing.platform_data["source_sourcing_item_id"] == item.id
        assert listing.platform_data["pricing_confirmation"]["selling_price_rmb"] == 26.29
        assert listing.platform_data["listing_store_override"]["store_label"] == "Shopee MY"
        assert listing.platform_data["listing_store_override"]["sku_count"] == 1

    asyncio.run(run_test())

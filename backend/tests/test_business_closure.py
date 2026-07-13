"""Regression tests for local listing, dashboard, and evidence closure."""

import asyncio
import io
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.datastructures import UploadFile
from PIL import Image

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.content_asset import ContentAsset
from app.models.fee_template import FeeTemplate
from app.models.inventory_alert import InventoryAlertRule
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.listing_template import ListingTemplate
from app.models.order import Order
from app.models.shipment import Shipment
from app.models.product_discovery import ProductDiscovery
from app.models.sourcing_item import SourcingItem
from app.models.supply_product import SupplyProduct
from app.models.trend_keyword import TrendKeyword
from app.models.trending_product import TrendingProduct
from app.services.batch_publish_service import confirm_publish, generate_listing_assist, generate_listing_drafts, list_publish_ready_items
from app.services.content_workbench_service import REQUIRED_CONTENT_GAPS
from app.services.dashboard_service import get_dashboard_summary
from app.services.discovery_service import analyze_discovery
from app.services.inventory_alert_service import check_inventory
from app.services.listing_instance_service import get_product_listing_matrix, promote_listing_to_base_version, update_listing_overrides
from app.services.promotion_service import (
    add_promotion_campaign_items,
    create_promotion_campaign,
    list_promotion_campaigns,
    sync_promotion_campaign,
    update_promotion_campaign,
    update_promotion_campaign_items_discount,
    update_promotion_campaign_status,
)
from app.services.product_image_service import attach_product_image_upload
from app.services.product_service import batch_update_stock
from app.api.v1.products import router as products_router
from app.services.sync_service import SyncService
from app.integrations.base import PlatformProduct
from app.integrations.factory import PlatformClientFactory
from app.services.shipment_service import update_shipment
from app.schemas.shipment import ShipmentUpdate


def test_confirm_publish_uses_owned_real_sourcing_data(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'publish.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="店铺", is_active=True)
            content_tasks = {
                task_type: {"confirmed_version": 1, "versions": [{"version": 1, "content": "已确认"}]}
                for task_type, _label in REQUIRED_CONTENT_GAPS
            }
            item = SourcingItem(
                user_id="user-a", source_name="1688", source_price_rmb=12.5, selling_price_local=28,
                product_name="真实商品", platform="shopee", market="MY", pipeline_stage="price_confirmed",
                extra_data={"content_tasks": content_tasks, "pricing_confirmation": {"listing_id": "draft-1"}},
            )
            session.add_all([account, item])
            await session.commit()
            result = await confirm_publish(session, "user-a", [{
                "confirmed": True,
                "publishable": True,
                "platform": "shopee",
                "sourcing_item_id": item.id,
                "selling_price": 28,
                "template_title": "真实商品标题",
                "template_description": "确认后的平台商品描述",
                "platform_requirements": {
                    "required_attributes": ["类目", "品牌", "材质"],
                    "attribute_values": {"类目": "收纳用品", "品牌": "No Brand", "材质": "毛毡"},
                },
                "source_price_rmb": 1,
            }])
            product = (await session.execute(select(Product))).scalar_one()
            listing = (await session.execute(select(PlatformListing))).scalar_one()
        await engine.dispose()

        assert result[0]["publish_status"] == "draft"
        assert product.cost_price == 12.5
        assert product.sku
        assert listing.price == 28
        assert listing.title == "真实商品标题"
        assert listing.description == "确认后的平台商品描述"
        assert listing.platform_data["stock_status"] == "missing"
        assert listing.platform_data["platform_requirements"]["attribute_values"]["材质"] == "毛毡"

    asyncio.run(run_test())


def test_platform_store_products_list_groups_synced_listings_by_store(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'platform-store-products.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            shopee_a = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A店", is_active=True)
            shopee_b = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee B店", is_active=True)
            product = Product(user_id="user-a", sku="SKU-SYNCED", name="平台同步真实商品", images=["https://img.example.com/1.jpg"])
            session.add_all([shopee_a, shopee_b, product])
            await session.flush()
            session.add_all([
                PlatformListing(
                    user_id="user-a",
                    product_id=product.id,
                    platform_account_id=shopee_a.id,
                    platform_product_id="SP-A-001",
                    title="A店标题",
                    description="A店描述",
                    price=19.9,
                    stock=12,
                    status="active",
                    images=["https://img.example.com/a1.jpg"],
                    platform_data={"source": "platform_product_sync"},
                    last_synced_at=datetime.now(timezone.utc),
                ),
                PlatformListing(
                    user_id="user-a",
                    product_id=product.id,
                    platform_account_id=shopee_b.id,
                    platform_product_id="SP-B-001",
                    title="B店标题",
                    description="B店描述",
                    price=21.9,
                    stock=5,
                    status="paused",
                    images=["https://img.example.com/b1.jpg"],
                    platform_data={"source": "platform_product_sync"},
                    last_synced_at=datetime.now(timezone.utc),
                ),
            ])
            await session.commit()
            items, total = await SyncService(session).list_platform_store_products("user-a", platform="shopee")
        await engine.dispose()

        assert total == 2
        assert {item["store"]["account_name"] for item in items} == {"Shopee A店", "Shopee B店"}
        assert {item["platform_product_id"] for item in items} == {"SP-A-001", "SP-B-001"}
        assert items[0]["product_master"]["sku"] == "SKU-SYNCED"
        assert items[0]["image_count"] == 1
        assert items[0]["source"] == "platform_product_sync"
        assert items[0]["media_readiness"]["captured_image_count"] == 1
        assert items[0]["media_readiness"]["min_platform_images"] == 5
        assert items[0]["media_readiness"]["missing_image_count"] == 4
        assert "缺少平台辅图" in items[0]["media_readiness"]["gaps"]

    asyncio.run(run_test())


def test_product_sync_imports_remote_products_as_store_listing_instances(tmp_path):
    class FakeProductClient:
        def __init__(self, account, encryption_service):
            self.account = account

        async def authenticate(self):
            return True

        async def get_products(self, page=1, page_size=50):
            if page > 1:
                return [], 1
            return [
                PlatformProduct(
                    platform_product_id="SP-REMOTE-001",
                    title="远程真实商品",
                    description="来自平台接口的描述",
                    price=29.9,
                    stock=18,
                    variations=[{"sku": "REMOTE-SKU-1", "name": "默认规格", "stock": 18}],
                    images=["https://img.example.com/remote-1.jpg", "https://img.example.com/remote-2.jpg"],
                    status="active",
                    platform_category_id="CAT-01",
                    raw_data={"merchant_sku": "REMOTE-SKU-1"},
                )
            ], 1

    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-sync.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        original_client = PlatformClientFactory.get_client
        original_connectors = __import__("app.integrations.status", fromlist=["PLATFORM_CONNECTORS"]).PLATFORM_CONNECTORS["shopee"]
        try:
            __import__("app.integrations.status", fromlist=["PLATFORM_CONNECTORS"]).PLATFORM_CONNECTORS["shopee"] = {
                "implementation_status": "implemented",
                "implemented_operations": ("authenticate", "products"),
                "required_inputs": (),
            }
            PlatformClientFactory.get_client = staticmethod(lambda platform, account, decrypt: FakeProductClient(account, decrypt))
            async with sessions() as session:
                account = PlatformAccount(
                    user_id="user-a",
                    platform="shopee",
                    account_name="Shopee A店",
                    shop_id="shop-a",
                    api_key_encrypted="key",
                    api_secret_encrypted="secret",
                    access_token_encrypted="access-token",
                    refresh_token_encrypted="refresh-token",
                    token_expires_at=datetime.now(timezone.utc).replace(year=datetime.now(timezone.utc).year + 1),
                    token_scopes=["products"],
                    is_active=True,
                )
                session.add(account)
                await session.commit()
                log = await SyncService(session).sync_products_for_account(account)
                await session.refresh(account)
                listing = (await session.execute(select(PlatformListing))).scalar_one()
                product = (await session.execute(select(Product))).scalar_one()
        finally:
            PlatformClientFactory.get_client = original_client
            __import__("app.integrations.status", fromlist=["PLATFORM_CONNECTORS"]).PLATFORM_CONNECTORS["shopee"] = original_connectors
            await engine.dispose()

        assert log.status == "success"
        assert log.sync_type == "products"
        assert log.records_created == 1
        assert listing.platform_account_id == account.id
        assert listing.platform_product_id == "SP-REMOTE-001"
        assert listing.title == "远程真实商品"
        assert listing.images == ["https://img.example.com/remote-1.jpg", "https://img.example.com/remote-2.jpg"]
        assert listing.platform_data["source"] == "platform_product_sync"
        assert product.attributes["platform_product_source"]["platform_product_id"] == "SP-REMOTE-001"
        assert account.settings["sync_state"]["products"]["status"] == "success"
        assert account.settings["sync_state"]["products"]["records_processed"] == 1
        assert account.settings["sync_state"]["products"]["records_created"] == 1
        assert account.settings["sync_state"]["products"]["last_attempt_at"]

    asyncio.run(run_test())


def test_product_sync_links_same_internal_sku_to_one_product_master_across_stores(tmp_path):
    class FakeStoreSkuProductClient:
        def __init__(self, account, encryption_service):
            self.account = account

        async def authenticate(self):
            return True

        async def get_products(self, page=1, page_size=50):
            if page > 1:
                return [], 1
            return [
                PlatformProduct(
                    platform_product_id=f"REMOTE-{self.account.shop_id}",
                    title=f"{self.account.account_name} 店铺标题",
                    description=f"{self.account.account_name} 店铺描述",
                    price=29.9 if self.account.shop_id == "shop-a" else 31.9,
                    stock=18 if self.account.shop_id == "shop-a" else 9,
                    variations=[{"sku": "MASTER-SKU-001", "name": "默认规格", "stock": 18}],
                    images=[f"https://img.example.com/{self.account.shop_id}.jpg"],
                    status="active",
                    platform_category_id="CAT-01",
                    raw_data={"merchant_sku": "MASTER-SKU-001"},
                )
            ], 1

    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-sync-master-link.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        original_client = PlatformClientFactory.get_client
        original_connectors = __import__("app.integrations.status", fromlist=["PLATFORM_CONNECTORS"]).PLATFORM_CONNECTORS["shopee"]
        try:
            __import__("app.integrations.status", fromlist=["PLATFORM_CONNECTORS"]).PLATFORM_CONNECTORS["shopee"] = {
                "implementation_status": "implemented",
                "implemented_operations": ("authenticate", "products"),
                "required_inputs": (),
            }
            PlatformClientFactory.get_client = staticmethod(lambda platform, account, decrypt: FakeStoreSkuProductClient(account, decrypt))
            async with sessions() as session:
                product = Product(
                    user_id="user-a",
                    sku="MASTER-SKU-001",
                    name="商品主档原始名称",
                    description="主档描述不得被店铺同步覆盖",
                    images=["https://img.example.com/master.jpg"],
                    status="active",
                )
                store_a = PlatformAccount(
                    user_id="user-a",
                    platform="shopee",
                    account_name="Shopee A",
                    shop_id="shop-a",
                    api_key_encrypted="key",
                    api_secret_encrypted="secret",
                    access_token_encrypted="access-token-a",
                    refresh_token_encrypted="refresh-token-a",
                    token_expires_at=datetime.now(timezone.utc).replace(year=datetime.now(timezone.utc).year + 1),
                    token_scopes=["products"],
                    is_active=True,
                )
                store_b = PlatformAccount(
                    user_id="user-a",
                    platform="shopee",
                    account_name="Shopee B",
                    shop_id="shop-b",
                    api_key_encrypted="key",
                    api_secret_encrypted="secret",
                    access_token_encrypted="access-token-b",
                    refresh_token_encrypted="refresh-token-b",
                    token_expires_at=datetime.now(timezone.utc).replace(year=datetime.now(timezone.utc).year + 1),
                    token_scopes=["products"],
                    is_active=True,
                )
                session.add_all([product, store_a, store_b])
                await session.commit()

                await SyncService(session).sync_products_for_account(store_a)
                await SyncService(session).sync_products_for_account(store_b)
                products = (await session.execute(select(Product))).scalars().all()
                listings = (await session.execute(select(PlatformListing))).scalars().all()
                product_after = await session.get(Product, product.id)
        finally:
            PlatformClientFactory.get_client = original_client
            __import__("app.integrations.status", fromlist=["PLATFORM_CONNECTORS"]).PLATFORM_CONNECTORS["shopee"] = original_connectors
            await engine.dispose()

        assert len(products) == 1
        assert product_after.name == "商品主档原始名称"
        assert product_after.description == "主档描述不得被店铺同步覆盖"
        assert product_after.images == ["https://img.example.com/master.jpg"]
        assert len(listings) == 2
        assert {item.product_id for item in listings} == {product.id}
        assert {item.platform_account_id for item in listings} == {store_a.id, store_b.id}
        assert {item.title for item in listings} == {"Shopee A 店铺标题", "Shopee B 店铺标题"}
        assert {item.price for item in listings} == {29.9, 31.9}

    asyncio.run(run_test())


def test_batch_preview_accepts_owned_product_master_records(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-preview.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee MY", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-PREVIEW",
                name="商品库真实商品",
                cost_price=18,
                images=["/uploads/product.png"],
                status="active",
            )
            session.add_all([
                account,
                product,
                ListingTemplate(
                    user_id="user-a",
                    name="Shopee 默认模板",
                    platform="shopee",
                    template_data={
                        "title_template": "{{product_name}} 官方同款",
                        "description_template": "{{product_name}} 可用于东南亚测款",
                    },
                    is_default=True,
                ),
                FeeTemplate(
                    platform="shopee",
                    market="MY",
                    commission_pct=8,
                    transaction_fee_pct=2,
                    tech_service_pct=1,
                    is_active=True,
                ),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[],
                product_ids=[product.id],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[account.id],
            )
        await engine.dispose()

        assert len(drafts) == 1
        assert drafts[0]["source_type"] == "product"
        assert drafts[0]["source_product_id"] == product.id
        assert drafts[0]["product_name"] == "商品库真实商品"
        assert drafts[0]["source_price_rmb"] == 18
        assert drafts[0]["publishable"] is False
        assert "platform_fields.required" in drafts[0]["data_gaps"]

    asyncio.run(run_test())


def test_batch_preview_reuses_existing_product_listing_draft(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-draft-preview.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee MY", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-DRAFT",
                name="定价后商品",
                cost_price=18,
                status="draft",
                images=["https://cbu01.alicdn.com/img/example.jpg"],
                attributes={"platform_requirements": {"shopee": {"attribute_values": {"品牌": "No Brand"}}}},
            )
            session.add_all([account, product])
            await session.flush()
            listing = PlatformListing(
                user_id="user-a",
                product_id=product.id,
                platform_account_id=account.id,
                title="定价确认标题",
                description="定价确认描述",
                price=17.09,
                stock=0,
                status="draft",
                images=["https://cbu01.alicdn.com/img/example.jpg"],
                platform_data={"platform_requirements": {"attribute_values": {"材质": "编织"}}},
            )
            session.add_all([
                listing,
                FeeTemplate(
                    platform="shopee",
                    market="MY",
                    commission_pct=8,
                    transaction_fee_pct=2,
                    tech_service_pct=1,
                    is_active=True,
                ),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[],
                product_ids=[product.id],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[account.id],
            )
        await engine.dispose()

        assert len(drafts) == 1
        assert drafts[0]["source_type"] == "product"
        assert drafts[0]["source_product_id"] == product.id
        assert drafts[0]["selling_price"] == 17.09
        assert drafts[0]["template_title"] == "定价确认标题"
        assert drafts[0]["template_description"] == "定价确认描述"
        assert drafts[0]["template_missing"] is False
        assert drafts[0]["publishable"] is True
        assert drafts[0]["platform_requirements"]["attribute_values"]["材质"] == "编织"

    asyncio.run(run_test())


def test_batch_preview_quarantines_existing_test_residue_product(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'dirty-product-preview.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee MY", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-DIRTY",
                name="测试商品-自动化测试",
                cost_price=18,
                status="draft",
            )
            session.add_all([
                account,
                product,
                ListingTemplate(
                    user_id="user-a",
                    name="Shopee 默认模板",
                    platform="shopee",
                    template_data={"title_template": "{{product_name}} 官方同款"},
                    is_default=True,
                ),
                FeeTemplate(
                    platform="shopee",
                    market="MY",
                    commission_pct=8,
                    transaction_fee_pct=2,
                    tech_service_pct=1,
                    is_active=True,
                ),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[],
                product_ids=[product.id],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[account.id],
            )
        await engine.dispose()

        assert len(drafts) == 1
        assert drafts[0]["publishable"] is False
        assert "products.name_quality" in drafts[0]["data_gaps"]
        assert any("测试残留" in reason for reason in drafts[0]["blocking_reasons"])

    asyncio.run(run_test())


def test_product_listing_matrix_keeps_store_instances_separate(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-matrix.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            shopee_a = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            shopee_b = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee B", is_active=True)
            temu = PlatformAccount(user_id="user-a", platform="temu", account_name="TEMU Main", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-MATRIX",
                name="多店铺隔离商品",
                cost_price=30,
                weight_g=420,
                attributes={
                    "source_offer_id": "1688-10001",
                    "base_version": {
                        "version": 1,
                        "title": "基础标题",
                        "description": "基础描述",
                        "confirmed_by": "operator",
                    },
                },
                images=["https://cbu01.alicdn.com/img/matrix.jpg"],
            )
            session.add_all([shopee_a, shopee_b, temu, product])
            await session.flush()
            session.add_all([
                PlatformListing(
                    user_id="user-a", product_id=product.id, platform_account_id=shopee_a.id,
                    title="Shopee A 标题", description="A 描述", price=55, stock=100, status="draft",
                    images=["https://cbu01.alicdn.com/img/a.jpg"],
                    platform_data={"listing_overrides": {"title": "Shopee A 标题"}},
                ),
                PlatformListing(
                    user_id="user-a", product_id=product.id, platform_account_id=shopee_b.id,
                    title="Shopee B 标题", description="B 描述", price=58, stock=80, status="draft",
                    images=["https://cbu01.alicdn.com/img/b.jpg"],
                    platform_data={"listing_overrides": {"title": "Shopee B 标题"}},
                ),
                PlatformListing(
                    user_id="user-a", product_id=product.id, platform_account_id=temu.id,
                    title="TEMU 标题", description="TEMU 描述", price=52, stock=60, status="draft",
                    images=["https://cbu01.alicdn.com/img/t.jpg"],
                    platform_data={"platform_requirements": {"attribute_values": {"skc_id": "SKC-1"}}},
                ),
            ])
            await session.commit()

            matrix = await get_product_listing_matrix(session, "user-a", product.id)
        await engine.dispose()

        assert matrix["product_master"]["id"] == product.id
        assert matrix["product_master"]["name"] == "多店铺隔离商品"
        assert matrix["base_version"]["title"] == "基础标题"
        assert len(matrix["listing_instances"]) == 3
        assert {
            (item["platform"], item["store"]["account_name"], item["title"])
            for item in matrix["listing_instances"]
        } == {
            ("shopee", "Shopee A", "Shopee A 标题"),
            ("shopee", "Shopee B", "Shopee B 标题"),
            ("temu", "TEMU Main", "TEMU 标题"),
        }
        assert all("listing_overrides" in item for item in matrix["listing_instances"])
        assert all("snapshot" in item for item in matrix["listing_instances"])

    asyncio.run(run_test())


def test_listing_overrides_update_only_current_listing(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-overrides.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store_a = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            store_b = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee B", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-OVERRIDE",
                name="覆盖隔离商品",
                cost_price=20,
                attributes={"base_version": {"title": "基础标题"}},
            )
            session.add_all([store_a, store_b, product])
            await session.flush()
            listing_a = PlatformListing(
                user_id="user-a", product_id=product.id, platform_account_id=store_a.id,
                title="A 原标题", description="A 描述", price=40, stock=50, status="draft",
                platform_data={"listing_overrides": {"title": "A 原标题"}},
            )
            listing_b = PlatformListing(
                user_id="user-a", product_id=product.id, platform_account_id=store_b.id,
                title="B 原标题", description="B 描述", price=42, stock=70, status="draft",
                platform_data={"listing_overrides": {"title": "B 原标题"}},
            )
            session.add_all([listing_a, listing_b])
            await session.commit()

            updated = await update_listing_overrides(
                session,
                user_id="user-a",
                listing_id=listing_b.id,
                overrides={
                    "title": "B 店铺专属标题",
                    "price": 39.9,
                    "platform_attributes": {"material": "canvas"},
                    "video_url": "https://video.example.com/listing-b.mp4",
                    "source_url": "https://detail.1688.com/offer/123.html",
                    "shipping_config": {
                        "weight_g": 140,
                        "package_size_cm": {"length": 19, "width": 6, "height": 12},
                        "logistics_note": "TikTok/Shopee 店铺覆盖物流资料",
                    },
                    "publish_plan": {
                        "mode": "scheduled",
                        "scheduled_at": "2026-07-16T10:30:00+08:00",
                        "status": "local_planned",
                    },
                    "variations": [{"sku": "B-BLACK", "name": "黑色", "stock": 12, "price": 39.9}],
                    "images": [
                        "https://cbu01.alicdn.com/img/b-main.jpg",
                        "https://cbu01.alicdn.com/img/b-2.jpg",
                    ],
                },
            )
            matrix = await get_product_listing_matrix(session, "user-a", product.id)
            product_after = await session.get(Product, product.id)
            listing_a_after = await session.get(PlatformListing, listing_a.id)
            listing_b_after = await session.get(PlatformListing, listing_b.id)
        await engine.dispose()

        assert updated is not None
        assert product_after.attributes["base_version"]["title"] == "基础标题"
        assert listing_a_after.title == "A 原标题"
        assert (listing_a_after.platform_data or {})["listing_overrides"]["title"] == "A 原标题"
        assert listing_b_after.title == "B 店铺专属标题"
        assert listing_b_after.price == 39.9
        assert listing_b_after.variations == [{"sku": "B-BLACK", "name": "黑色", "stock": 12, "price": 39.9}]
        assert listing_b_after.images == [
            "https://cbu01.alicdn.com/img/b-main.jpg",
            "https://cbu01.alicdn.com/img/b-2.jpg",
        ]
        assert (listing_b_after.platform_data or {})["listing_overrides"]["platform_attributes"]["material"] == "canvas"
        assert (listing_b_after.platform_data or {})["listing_overrides"]["video_url"] == "https://video.example.com/listing-b.mp4"
        assert (listing_b_after.platform_data or {})["listing_overrides"]["source_url"].startswith("https://detail.1688.com")
        assert (listing_b_after.platform_data or {})["listing_overrides"]["shipping_config"]["package_size_cm"]["height"] == 12
        assert "promotion_config" not in (listing_b_after.platform_data or {})["listing_overrides"]
        assert (listing_b_after.platform_data or {})["publish_plan"]["mode"] == "scheduled"
        instances = {item["store"]["account_name"]: item for item in matrix["listing_instances"]}
        assert instances["Shopee A"]["title"] == "A 原标题"
        assert "shipping_config" not in instances["Shopee A"]["listing_overrides"]
        assert instances["Shopee B"]["title"] == "B 店铺专属标题"
        assert instances["Shopee B"]["variations"][0]["sku"] == "B-BLACK"
        assert instances["Shopee B"]["images"][0].endswith("b-main.jpg")
        assert instances["Shopee B"]["video_url"].endswith("listing-b.mp4")
        assert instances["Shopee B"]["source_url"].endswith("123.html")
        assert instances["Shopee B"]["shipping_config"]["weight_g"] == 140
        assert instances["Shopee B"]["publish_plan"]["scheduled_at"].startswith("2026-07-16")

    asyncio.run(run_test())


def test_listing_override_update_removes_legacy_promotion_config(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-legacy-promotion.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            product = Product(user_id="user-a", sku="SKU-LEGACY-PROMO", name="旧促销残留商品", cost_price=20)
            session.add_all([store, product])
            await session.flush()
            listing = PlatformListing(
                user_id="user-a",
                product_id=product.id,
                platform_account_id=store.id,
                title="旧促销残留 Listing",
                description="旧描述",
                price=50,
                stock=100,
                status="draft",
                platform_data={
                    "listing_overrides": {
                        "title": "旧促销残留 Listing",
                        "promotion_config": {"discount_price": 39.9, "activity_name": "历史页内促销"},
                    }
                },
            )
            session.add(listing)
            await session.commit()

            updated = await update_listing_overrides(
                session,
                user_id="user-a",
                listing_id=listing.id,
                overrides={"title": "清理旧促销后的 Listing"},
            )
            listing_after = await session.get(PlatformListing, listing.id)
        await engine.dispose()

        assert updated["title"] == "清理旧促销后的 Listing"
        assert listing_after.title == "清理旧促销后的 Listing"
        assert "promotion_config" not in (listing_after.platform_data or {}).get("listing_overrides", {})

    asyncio.run(run_test())


def test_listing_can_promote_explicit_new_base_version_without_touching_siblings(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-promote-base.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store_a = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            store_b = PlatformAccount(user_id="user-a", platform="tiktok", account_name="TikTok PH", is_active=True, settings={"market": "PH"})
            product = Product(
                user_id="user-a",
                sku="SKU-BASE-PROMOTE",
                name="基础版本反哺商品",
                description="旧基础描述",
                cost_price=20,
                attributes={"base_version": {"version": 1, "title": "旧基础标题", "description": "旧基础描述"}},
                images=["https://cbu01.alicdn.com/img/old-master.jpg"],
            )
            session.add_all([store_a, store_b, product])
            await session.flush()
            listing_a = PlatformListing(
                user_id="user-a", product_id=product.id, platform_account_id=store_a.id,
                title="Shopee A 标题", description="A 描述", price=40, stock=50, status="draft",
                images=["https://cbu01.alicdn.com/img/a.jpg"],
                platform_data={"listing_overrides": {"title": "Shopee A 标题"}},
            )
            listing_b = PlatformListing(
                user_id="user-a", product_id=product.id, platform_account_id=store_b.id,
                title="TikTok 已验证标题", description="TikTok 已验证描述", price=42, stock=70, status="draft",
                images=[
                    "https://cbu01.alicdn.com/img/tiktok-main.jpg",
                    "https://cbu01.alicdn.com/img/tiktok-size.jpg",
                ],
                variations=[{"sku": "TT-BLACK", "name": "黑色", "stock": 12, "price": 42}],
                platform_data={
                    "listing_overrides": {
                        "title": "TikTok 已验证标题",
                        "platform_attributes": {"material": "ABS"},
                    }
                },
            )
            session.add_all([listing_a, listing_b])
            await session.commit()

            promoted = await promote_listing_to_base_version(session, "user-a", listing_b.id)
            matrix = await get_product_listing_matrix(session, "user-a", product.id)
            product_after = await session.get(Product, product.id)
            listing_a_after = await session.get(PlatformListing, listing_a.id)
            listing_b_after = await session.get(PlatformListing, listing_b.id)
        await engine.dispose()

        assert promoted is not None
        assert promoted["base_version"]["version"] == 2
        assert promoted["base_version"]["title"] == "TikTok 已验证标题"
        assert promoted["base_version"]["source_listing_id"] == listing_b.id
        assert promoted["base_version"]["source_platform"] == "tiktok"
        assert product_after.name == "基础版本反哺商品"
        assert product_after.description == "TikTok 已验证描述"
        assert product_after.images == [
            "https://cbu01.alicdn.com/img/tiktok-main.jpg",
            "https://cbu01.alicdn.com/img/tiktok-size.jpg",
        ]
        assert product_after.attributes["base_version"]["attribute_values"]["material"] == "ABS"
        assert listing_a_after.title == "Shopee A 标题"
        assert listing_b_after.title == "TikTok 已验证标题"
        assert matrix["base_version"]["version"] == 2
        assert matrix["base_version"]["source_store"]["account_name"] == "TikTok PH"

    asyncio.run(run_test())


def test_promotion_campaign_is_independent_and_contains_multiple_listings(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'promotion-campaign.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            product_a = Product(user_id="user-a", sku="PROMO-A", name="促销商品A", cost_price=20)
            product_b = Product(user_id="user-a", sku="PROMO-B", name="促销商品B", cost_price=30)
            session.add_all([store, product_a, product_b])
            await session.flush()
            listing_a = PlatformListing(
                user_id="user-a", product_id=product_a.id, platform_account_id=store.id,
                title="促销商品A Listing", description="", price=49, stock=100, status="active",
            )
            listing_b = PlatformListing(
                user_id="user-a", product_id=product_b.id, platform_account_id=store.id,
                title="促销商品B Listing", description="", price=59, stock=80, status="active",
            )
            session.add_all([listing_a, listing_b])
            await session.commit()

            created = await create_promotion_campaign(session, "user-a", {
                "platform_account_id": store.id,
                "name": "Shopee 七月分类折扣",
                "promotion_type": "discount",
                "status": "scheduled",
                "starts_at": "2026-07-15T00:00:00+08:00",
                "ends_at": "2026-07-22T23:59:59+08:00",
                "items": [
                    {"platform_listing_id": listing_a.id, "discount_type": "percentage", "discount_value": 10, "promotion_price": 44.1},
                    {"platform_listing_id": listing_b.id, "discount_type": "fixed_price", "discount_value": 39.9, "promotion_price": 39.9},
                ],
            })
            campaigns = await list_promotion_campaigns(session, "user-a")
            listing_a_after = await session.get(PlatformListing, listing_a.id)
        await engine.dispose()

        assert created["name"] == "Shopee 七月分类折扣"
        assert created["store"]["account_name"] == "Shopee A"
        assert created["product_count"] == 2
        assert {item["platform_listing_id"] for item in created["items"]} == {listing_a.id, listing_b.id}
        assert campaigns[0]["items"][0]["product_name"] in {"促销商品A", "促销商品B"}
        assert "promotion_config" not in (listing_a_after.platform_data or {}).get("listing_overrides", {})

    asyncio.run(run_test())


def test_promotion_campaign_can_end_without_touching_listings(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'promotion-end.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            product = Product(user_id="user-a", sku="PROMO-END", name="可结束促销商品", cost_price=20)
            session.add_all([store, product])
            await session.flush()
            listing = PlatformListing(
                user_id="user-a", product_id=product.id, platform_account_id=store.id,
                title="可结束促销商品 Listing", description="", price=49, stock=100, status="active",
            )
            session.add(listing)
            await session.commit()

            created = await create_promotion_campaign(session, "user-a", {
                "platform_account_id": store.id,
                "name": "Shopee 本地可结束活动",
                "status": "active",
                "items": [{"platform_listing_id": listing.id, "discount_value": 10}],
            })
            ended = await update_promotion_campaign_status(session, "user-a", created["id"], "ended")
            listing_after = await session.get(PlatformListing, listing.id)
        await engine.dispose()

        assert ended["status"] == "ended"
        assert ended["product_count"] == 1
        assert listing_after.status == "active"
        assert "promotion_config" not in (listing_after.platform_data or {}).get("listing_overrides", {})

    asyncio.run(run_test())


def test_promotion_campaign_can_add_items_and_update_discount_without_touching_listings(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'promotion-items-discount.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            product_a = Product(user_id="user-a", sku="PROMO-ITEM-A", name="活动商品A", cost_price=20)
            product_b = Product(user_id="user-a", sku="PROMO-ITEM-B", name="活动商品B", cost_price=22)
            session.add_all([store, product_a, product_b])
            await session.flush()
            listing_a = PlatformListing(
                user_id="user-a", product_id=product_a.id, platform_account_id=store.id,
                title="活动商品A Listing", description="", price=50, stock=100, status="active",
            )
            listing_b = PlatformListing(
                user_id="user-a", product_id=product_b.id, platform_account_id=store.id,
                title="活动商品B Listing", description="", price=60, stock=90, status="active",
            )
            session.add_all([listing_a, listing_b])
            await session.commit()

            created = await create_promotion_campaign(session, "user-a", {
                "platform_account_id": store.id,
                "name": "Shopee 活动追加商品",
                "items": [{"platform_listing_id": listing_a.id, "discount_value": 10}],
            })
            added = await add_promotion_campaign_items(session, "user-a", created["id"], [
                {"platform_listing_id": listing_b.id, "discount_value": 8, "stock_limit": 20},
            ])
            updated = await update_promotion_campaign_items_discount(session, "user-a", created["id"], 15)
            listing_a_after = await session.get(PlatformListing, listing_a.id)
            listing_b_after = await session.get(PlatformListing, listing_b.id)
        await engine.dispose()

        assert added["product_count"] == 2
        assert {item["platform_listing_id"] for item in added["items"]} == {listing_a.id, listing_b.id}
        assert {item["discount_value"] for item in updated["items"]} == {15}
        assert listing_a_after.status == "active"
        assert listing_b_after.status == "active"
        assert "promotion_config" not in (listing_a_after.platform_data or {}).get("listing_overrides", {})
        assert "promotion_config" not in (listing_b_after.platform_data or {}).get("listing_overrides", {})

    asyncio.run(run_test())


def test_promotion_campaign_can_update_basic_info_without_touching_items_or_listings(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'promotion-basic-update.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            product = Product(user_id="user-a", sku="PROMO-EDIT", name="可编辑促销商品", cost_price=20)
            session.add_all([store, product])
            await session.flush()
            listing = PlatformListing(
                user_id="user-a", product_id=product.id, platform_account_id=store.id,
                title="可编辑促销商品 Listing", description="", price=50, stock=100, status="active",
            )
            session.add(listing)
            await session.commit()

            created = await create_promotion_campaign(session, "user-a", {
                "platform_account_id": store.id,
                "name": "旧活动名称",
                "status": "draft",
                "starts_at": "2026-07-15T00:00:00+08:00",
                "items": [{"platform_listing_id": listing.id, "discount_value": 10}],
            })
            updated = await update_promotion_campaign(session, "user-a", created["id"], {
                "name": "新活动名称",
                "status": "scheduled",
                "starts_at": "2026-07-20T00:00:00+08:00",
                "ends_at": "2026-07-25T23:59:59+08:00",
                "stack_rule": "no_stack",
            })
            listing_after = await session.get(PlatformListing, listing.id)
        await engine.dispose()

        assert updated["name"] == "新活动名称"
        assert updated["status"] == "scheduled"
        assert updated["starts_at"].startswith("2026-07-20")
        assert updated["ends_at"].startswith("2026-07-25")
        assert updated["stack_rule"] == "no_stack"
        assert updated["product_count"] == 1
        assert updated["items"][0]["platform_listing_id"] == listing.id
        assert listing_after.status == "active"
        assert "promotion_config" not in (listing_after.platform_data or {}).get("listing_overrides", {})

    asyncio.run(run_test())


def test_promotion_campaign_sync_reports_open_api_gap_without_fake_platform_state(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'promotion-sync-gap.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            product = Product(user_id="user-a", sku="PROMO-SYNC", name="同步缺口促销商品", cost_price=20)
            session.add_all([store, product])
            await session.flush()
            listing = PlatformListing(
                user_id="user-a", product_id=product.id, platform_account_id=store.id,
                title="同步缺口促销商品 Listing", description="", price=50, stock=100, status="active",
            )
            session.add(listing)
            await session.commit()

            created = await create_promotion_campaign(session, "user-a", {
                "platform_account_id": store.id,
                "name": "Shopee 待同步本地活动",
                "status": "scheduled",
                "items": [{"platform_listing_id": listing.id, "discount_value": 10}],
            })
            sync_result = await sync_promotion_campaign(session, "user-a", created["id"])
            campaigns = await list_promotion_campaigns(session, "user-a")
        await engine.dispose()

        assert sync_result["status"] == "configuration_required"
        assert "promotion_open_api.not_implemented" in sync_result["data_gaps"]
        assert sync_result["campaign"]["external_promotion_id"] is None
        assert campaigns[0]["external_promotion_id"] is None
        assert campaigns[0]["status"] == "scheduled"

    asyncio.run(run_test())


def test_product_image_upload_creates_asset_and_appends_product_image(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-image-upload.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            product = Product(
                user_id="user-a",
                sku="SKU-IMG-UPLOAD",
                name="图片上传商品",
                images=[],
                status="draft",
            )
            session.add(product)
            await session.commit()

            upload = UploadFile(filename="real-product.png", file=io.BytesIO(_png_bytes()))
            result = await attach_product_image_upload(session, "user-a", product.id, upload)
            product_after = await session.get(Product, product.id)
            assets = list((await session.execute(select(ContentAsset).where(ContentAsset.user_id == "user-a"))).scalars().all())
        await engine.dispose()

        assert len(assets) == 1
        assert result["product_id"] == product.id
        assert result["asset"]["id"] == assets[0].id
        assert result["image_url"] == f"/api/v1/content/assets/{assets[0].id}/file"
        assert product_after.images == [result["image_url"]]
        assert assets[0].operation == "product_image_upload"
        assert assets[0].extra["product_id"] == product.id
        assert assets[0].extra["usage"] == "product_master_image"

    asyncio.run(run_test())


def _png_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (32, 32), "#FFFFFF").save(output, format="PNG")
    return output.getvalue()


def test_batch_preview_generates_store_level_listing_drafts(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'store-level-preview.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store_a = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            store_b = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee B", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-STORE-DRAFT",
                name="多店铺刊登商品",
                cost_price=18,
                images=["https://cbu01.alicdn.com/img/store-draft.jpg"],
                status="active",
            )
            session.add_all([
                store_a,
                store_b,
                product,
                ListingTemplate(
                    user_id="user-a",
                    name="Shopee 默认模板",
                    platform="shopee",
                    template_data={"title_template": "{{product_name}} 店铺版"},
                    is_default=True,
                ),
                FeeTemplate(platform="shopee", market="MY", commission_pct=8, transaction_fee_pct=2, tech_service_pct=1, is_active=True),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[],
                product_ids=[product.id],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[store_a.id, store_b.id],
            )
        await engine.dispose()

        assert len(drafts) == 2
        assert {draft["platform_account_id"] for draft in drafts} == {store_a.id, store_b.id}
        assert {draft["store"]["account_name"] for draft in drafts} == {"Shopee A", "Shopee B"}
        assert all(draft["source_product_id"] == product.id for draft in drafts)

    asyncio.run(run_test())


def test_batch_preview_requires_explicit_store_selection(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'explicit-store-required.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store_a = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            store_b = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee B", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-NO-DEFAULT-STORE",
                name="必须选择店铺的商品",
                cost_price=18,
                images=["https://cbu01.alicdn.com/img/no-default-store.jpg"],
                status="active",
            )
            session.add_all([
                store_a,
                store_b,
                product,
                ListingTemplate(
                    user_id="user-a",
                    name="Shopee 默认模板",
                    platform="shopee",
                    template_data={"title_template": "{{product_name}} 店铺版"},
                    is_default=True,
                ),
                FeeTemplate(platform="shopee", market="MY", commission_pct=8, transaction_fee_pct=2, tech_service_pct=1, is_active=True),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[],
                product_ids=[product.id],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[],
            )
        await engine.dispose()

        assert drafts == []

    asyncio.run(run_test())


def test_confirm_publish_creates_listing_for_selected_store(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'store-level-confirm.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store_a = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee A", is_active=True)
            store_b = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee B", is_active=True)
            product = Product(user_id="user-a", sku="SKU-STORE-CONFIRM", name="指定店铺商品", cost_price=22)
            session.add_all([store_a, store_b, product])
            await session.commit()

            result = await confirm_publish(session, "user-a", [{
                "confirmed": True,
                "publishable": True,
                "source_type": "product",
                "source_product_id": product.id,
                "platform": "shopee",
                "platform_account_id": store_b.id,
                "market": "MY",
                "selling_price": 49,
                "template_title": "Shopee B 专属标题",
                "template_description": "B 店铺描述",
                "platform_requirements": {"attribute_values": {"品牌": "No Brand"}},
                "source_price_rmb": 22,
            }])
            listing = (await session.execute(select(PlatformListing))).scalar_one()
        await engine.dispose()

        assert result[0]["publish_status"] == "draft"
        assert result[0]["platform_account_id"] == store_b.id
        assert listing.platform_account_id == store_b.id
        assert listing.title == "Shopee B 专属标题"

    asyncio.run(run_test())


def test_batch_preview_builds_full_listing_workspace_sections(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-workspace-sections.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee MY", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-FULL-WORKSPACE",
                name="平台属性完整商品",
                brand="No Brand",
                cost_price=28,
                weight_g=320,
                dimensions={"length_cm": 18, "width_cm": 12, "height_cm": 7},
                images=[
                    "https://cf.shopee.sg/file/sg-11134201-7ras9-example-main",
                    "https://cf.shopee.sg/file/sg-11134201-7ras9-example-side",
                ],
                attributes={
                    "variants": [
                        {"sku": "SKU-FULL-WORKSPACE-BLACK", "option_1_name": "颜色", "option_1_value": "黑色", "price": 59, "stock": 30},
                        {"sku": "SKU-FULL-WORKSPACE-WHITE", "option_1_name": "颜色", "option_1_value": "白色", "price": 59, "stock": 25},
                    ],
                    "video_url": "https://cdn.example.com/demo-product-video.mp4",
                    "compliance": {"condition": "new", "restricted_check_status": "passed"},
                },
            )
            session.add_all([
                account,
                product,
                ListingTemplate(
                    user_id="user-a",
                    name="Shopee 默认模板",
                    platform="shopee",
                    template_data={"title_template": "{{product_name}} 东南亚官方同款"},
                    is_default=True,
                ),
                FeeTemplate(platform="shopee", market="MY", commission_pct=8, transaction_fee_pct=2, tech_service_pct=1, is_active=True),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[],
                product_ids=[product.id],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[account.id],
            )
        await engine.dispose()

        assert len(drafts) == 1
        draft = drafts[0]
        assert draft["sku_plan"]["master_sku"] == "SKU-FULL-WORKSPACE"
        assert len(draft["sku_plan"]["variants"]) == 2
        assert draft["media_assets"]["main_image"].startswith("https://cf.shopee.sg/")
        assert draft["media_assets"]["videos"] == ["https://cdn.example.com/demo-product-video.mp4"]
        assert draft["logistics"]["weight_g"] == 320
        assert draft["logistics"]["dimensions"]["length_cm"] == 18
        assert draft["compliance"]["condition"] == "new"
        assert draft["compliance"]["restricted_check_status"] == "passed"

    asyncio.run(run_test())


def test_confirm_publish_persists_listing_workspace_sections(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-workspace-persist.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store = PlatformAccount(user_id="user-a", platform="tiktok", account_name="TikTok PH", is_active=True)
            product = Product(user_id="user-a", sku="SKU-PERSIST", name="落库完整商品", cost_price=21)
            session.add_all([store, product])
            await session.commit()

            result = await confirm_publish(session, "user-a", [{
                "confirmed": True,
                "publishable": True,
                "source_type": "product",
                "source_product_id": product.id,
                "platform": "tiktok",
                "platform_account_id": store.id,
                "market": "PH",
                "selling_price": 55,
                "template_title": "TikTok PH 专属标题",
                "template_description": "短视频渠道商品描述",
                "platform_requirements": {"attribute_values": {"Brand": "No Brand"}},
                "sku_plan": {
                    "master_sku": "SKU-PERSIST",
                    "variants": [{"sku": "SKU-PERSIST-M", "option_1_name": "Size", "option_1_value": "M", "price": 55, "stock": 12}],
                },
                "media_assets": {
                    "main_image": "https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/main.jpg",
                    "images": ["https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/main.jpg"],
                    "videos": ["https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/video.mp4"],
                },
                "logistics": {"weight_g": 260, "dimensions": {"length_cm": 16, "width_cm": 10, "height_cm": 6}, "preparation_days": 2},
                "compliance": {"condition": "new", "certifications": ["platform-policy-reviewed"]},
                "source_price_rmb": 21,
            }])
            listing = (await session.execute(select(PlatformListing))).scalar_one()
        await engine.dispose()

        assert result[0]["publish_status"] == "draft"
        assert listing.variations[0]["sku"] == "SKU-PERSIST-M"
        assert listing.images == ["https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/main.jpg"]
        assert listing.shipping_config["weight_g"] == 260
        assert listing.platform_data["media_assets"]["videos"][0].endswith("video.mp4")
        assert listing.platform_data["listing_overrides"]["sku_plan"]["variants"][0]["stock"] == 12
        assert listing.platform_data["compliance"]["certifications"] == ["platform-policy-reviewed"]

    asyncio.run(run_test())


def test_batch_preview_returns_listing_validation_checks(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-validation-checks.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee MY", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-CHECKS",
                name="校验商品",
                cost_price=20,
                images=[],
                attributes={"platform_requirements": {"shopee": {"attribute_values": {"品牌": "No Brand"}}}},
            )
            session.add_all([
                account,
                product,
                ListingTemplate(
                    user_id="user-a",
                    name="Shopee 默认模板",
                    platform="shopee",
                    template_data={"title_template": "{{product_name}} 校验标题"},
                    is_default=True,
                ),
                FeeTemplate(platform="shopee", market="MY", commission_pct=8, transaction_fee_pct=2, tech_service_pct=1, is_active=True),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[],
                product_ids=[product.id],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[account.id],
            )
        await engine.dispose()

        assert len(drafts) == 1
        checks = {check["code"]: check for check in drafts[0]["validation_checks"]}
        assert checks["title"]["state"] == "pass"
        assert checks["price"]["state"] == "pass"
        assert checks["media"]["state"] == "warning"
        assert checks["logistics"]["state"] == "warning"
        assert checks["platform_fields"]["state"] == "block"
        assert "仍缺平台已确认必填字段" in checks["platform_fields"]["message"]
        assert drafts[0]["publishable"] is False

    asyncio.run(run_test())


def test_confirm_publish_persists_listing_validation_checks(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-validation-persist.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee MY", is_active=True)
            product = Product(user_id="user-a", sku="SKU-CHECK-PERSIST", name="校验落库商品", cost_price=20)
            session.add_all([store, product])
            await session.commit()

            result = await confirm_publish(session, "user-a", [{
                "confirmed": True,
                "publishable": True,
                "source_type": "product",
                "source_product_id": product.id,
                "platform": "shopee",
                "platform_account_id": store.id,
                "market": "MY",
                "selling_price": 49,
                "template_title": "Shopee 校验标题",
                "template_description": "校验描述",
                "platform_requirements": {"attribute_values": {"品牌": "No Brand"}},
                "sku_plan": {"master_sku": "SKU-CHECK-PERSIST", "variants": []},
                "media_assets": {"images": [], "videos": []},
                "logistics": {"weight_g": None, "dimensions": {}},
                "compliance": {"condition": "new"},
                "source_price_rmb": 20,
            }])
            listing = (await session.execute(select(PlatformListing))).scalar_one()
        await engine.dispose()

        checks = {check["code"]: check for check in listing.platform_data["validation_checks"]}
        assert result[0]["validation_checks"][0]["code"]
        assert checks["media"]["state"] == "warning"
        assert checks["platform_fields"]["state"] == "pass"
        assert listing.platform_data["listing_snapshot"]["validation_checks"] == listing.platform_data["validation_checks"]

    asyncio.run(run_test())


def test_listing_assist_returns_copy_patch_without_saving(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-assist-copy.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            result = await generate_listing_assist(session, {
                "assist_type": "listing_copy",
                "product_name": "折叠收纳箱",
                "category": "家居收纳",
                "platform": "shopee",
                "market": "MY",
                "template_title": "",
                "template_description": "",
            })
        await engine.dispose()

        assert result["assist_type"] == "listing_copy"
        assert result["provider"] == "rule_engine"
        assert result["confidence"] == "low"
        assert result["patch"]["template_title"]
        assert "折叠收纳箱" in result["patch"]["template_description"]
        assert result["does_not_save"] is True

    asyncio.run(run_test())


def test_listing_assist_returns_video_and_image_plan_patches(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-assist-media.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            video = await generate_listing_assist(session, {
                "assist_type": "video_script",
                "product_name": "旅行洗漱包",
                "platform": "tiktok",
                "market": "PH",
            })
            image = await generate_listing_assist(session, {
                "assist_type": "image_edit_plan",
                "product_name": "旅行洗漱包",
                "platform": "tiktok",
                "market": "PH",
            })
        await engine.dispose()

        assert video["patch"]["media_assets"]["video_script"]
        assert image["patch"]["media_assets"]["image_edit_plan"]
        assert video["does_not_save"] is True
        assert image["does_not_save"] is True

    asyncio.run(run_test())


def test_batch_preview_blocks_confirmed_required_platform_fields(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-required-fields.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee MY", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-REQUIRED-FIELDS",
                name="平台必填字段商品",
                cost_price=18,
                attributes={
                        "platform_requirements": {
                            "shopee": {
                            "required_attributes": ["category", "draft_dynamic"],
                            "field_groups": [{
                                "id": "identity",
                                "fields": [
                                    {"key": "category", "label": "类目", "required": True},
                                    {"key": "draft_dynamic", "label": "待补证动态字段", "required": True, "evidence_state": "needs_category_recheck"},
                                ],
                            }],
                            "attribute_values": {},
                        }
                    }
                },
            )
            session.add_all([
                account,
                product,
                ListingTemplate(
                    user_id="user-a",
                    name="Shopee 默认模板",
                    platform="shopee",
                    template_data={"title_template": "{{product_name}}"},
                    is_default=True,
                ),
                FeeTemplate(platform="shopee", market="MY", commission_pct=8, transaction_fee_pct=2, tech_service_pct=1, is_active=True),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[],
                product_ids=[product.id],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[account.id],
            )
        await engine.dispose()

        checks = {check["code"]: check for check in drafts[0]["validation_checks"]}
        assert drafts[0]["publishable"] is False
        assert drafts[0]["status"] == "data_required"
        assert "platform_fields.required" in drafts[0]["data_gaps"]
        assert checks["platform_fields"]["state"] == "block"
        assert "类目" in checks["platform_fields"]["message"]
        assert "待补证动态字段" in checks["platform_fields"]["message"]

    asyncio.run(run_test())


def test_batch_preview_warns_recheck_platform_fields_without_blocking(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-recheck-fields.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee MY", is_active=True)
            product = Product(
                user_id="user-a",
                sku="SKU-RECHECK-FIELDS",
                name="待补证字段商品",
                cost_price=18,
                attributes={
                    "platform_requirements": {
                        "shopee": {
                            "required_attributes": ["category", "draft_dynamic"],
                            "field_groups": [{
                                "id": "identity",
                                "fields": [
                                    {"key": "category", "label": "类目", "required": True},
                                    {"key": "draft_dynamic", "label": "待补证动态字段", "required": True, "evidence_state": "needs_category_recheck"},
                                ],
                            }],
                            "attribute_values": {"category": "收纳用品"},
                        }
                    }
                },
            )
            session.add_all([
                account,
                product,
                ListingTemplate(
                    user_id="user-a",
                    name="Shopee 默认模板",
                    platform="shopee",
                    template_data={"title_template": "{{product_name}}"},
                    is_default=True,
                ),
                FeeTemplate(platform="shopee", market="MY", commission_pct=8, transaction_fee_pct=2, tech_service_pct=1, is_active=True),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[],
                product_ids=[product.id],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[account.id],
            )
        await engine.dispose()

        checks = {check["code"]: check for check in drafts[0]["validation_checks"]}
        assert drafts[0]["publishable"] is True
        assert "platform_fields.required" not in drafts[0]["data_gaps"]
        assert checks["platform_fields"]["state"] == "warning"
        assert "待补证" in checks["platform_fields"]["message"]

    asyncio.run(run_test())


def test_listing_workbench_lists_only_content_and_pricing_ready_items(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'listing-workbench.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        content_tasks = {
            task_type: {"confirmed_version": 1, "versions": [{"version": 1, "content": "已确认"}]}
            for task_type, _label in REQUIRED_CONTENT_GAPS
        }
        async with sessions() as session:
            ready = SourcingItem(
                user_id="user-a", source_name="1688", source_price_rmb=18, selling_price_local=39,
                product_name="可刊登商品", platform="shopee", market="MY", pipeline_stage="price_confirmed",
                source_image="https://cdn.shopify.com/s/files/1/0015/3426/3341/files/4a172617-554b-4d17-bb89-19ca5fbdfbd7.png?v=1750758267",
                extra_data={
                    "content_tasks": content_tasks,
                    "pricing_confirmation": {"listing_id": "draft-1"},
                    "platform_requirements": {
                        "shopee": {
                            "required_attributes": ["类目", "品牌", "材质", "重量"],
                            "media": ["主图", "场景图"],
                            "content": ["标题", "卖点"],
                                "compliance": ["禁限售复核"],
                            }
                        },
                        "media_readiness": {
                            "captured_image_count": 1,
                            "missing_image_count": 4,
                            "gaps": ["缺少平台辅图", "缺少尺寸/规格图"],
                        },
                    },
                )
            no_content = SourcingItem(
                user_id="user-a", source_name="1688", source_price_rmb=18, selling_price_local=39,
                product_name="内容未确认商品", platform="shopee", market="MY", pipeline_stage="price_confirmed",
                extra_data={"pricing_confirmation": {"listing_id": "draft-2"}},
            )
            no_price = SourcingItem(
                user_id="user-a", source_name="1688", source_price_rmb=18, selling_price_local=39,
                product_name="未定价商品", platform="shopee", market="MY", pipeline_stage="decision_passed",
                extra_data={"content_tasks": content_tasks},
            )
            session.add_all([ready, no_content, no_price])
            await session.commit()

            items = await list_publish_ready_items(session, "user-a")
        await engine.dispose()

        assert len(items) == 1
        assert items[0]["id"] == ready.id
        assert items[0]["name"] == "可刊登商品"
        assert items[0]["work_item_id"] == f"sourcing_item:{ready.id}"
        assert items[0]["object_refs"] == [
            {"type": "sourcing_item", "id": ready.id, "label": "可刊登商品"}
        ]
        assert items[0]["lifecycle_status"] == "listing_ready"
        assert items[0]["lifecycle_label"] == "待平台刊登"
        assert items[0]["evidence_completeness"]["content"] == "present"
        assert items[0]["evidence_summary"]["total"] == 8
        assert items[0]["image_url"].startswith("https://")
        required_attributes = set(items[0]["platform_requirements"]["required_attributes"])
        assert {"类目", "品牌", "材质", "重量"}.issubset(required_attributes)
        assert {"category", "brand", "seller_sku"}.issubset(required_attributes)
        assert items[0]["media_readiness"]["captured_image_count"] == 1
        assert items[0]["media_readiness"]["missing_image_count"] == 4
        assert "缺少平台辅图" in items[0]["media_readiness"]["gaps"]
        assert items[0]["data_gaps"] == []

    asyncio.run(run_test())


def test_batch_preview_blocks_unpriced_sourcing_items(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'unpriced-listing.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        content_tasks = {
            task_type: {"confirmed_version": 1, "versions": [{"version": 1, "content": "已确认"}]}
            for task_type, _label in REQUIRED_CONTENT_GAPS
        }
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="Shopee MY", is_active=True)
            item = SourcingItem(
                user_id="user-a", source_name="1688", source_price_rmb=18, selling_price_local=39,
                product_name="未完成定价确认商品", platform="shopee", market="MY",
                pipeline_stage="decision_passed", extra_data={"content_tasks": content_tasks},
            )
            session.add_all([
                account,
                item,
                ListingTemplate(user_id="user-a", name="Shopee 模板", platform="shopee", template_data={"title_template": "{{product_name}}"}, is_default=True),
                FeeTemplate(platform="shopee", market="MY", commission_pct=8, transaction_fee_pct=2, tech_service_pct=1, is_active=True),
            ])
            await session.commit()

            drafts = await generate_listing_drafts(
                db=session,
                user_id="user-a",
                sourcing_item_ids=[item.id],
                product_ids=[],
                platforms=["shopee"],
                markets=["MY"],
                pricing_mode="cost_based",
                target_profit_pct=20,
                platform_account_ids=[account.id],
            )
        await engine.dispose()

        assert len(drafts) == 1
        assert drafts[0]["publishable"] is False
        assert "sourcing_items.pricing_confirmation" in drafts[0]["data_gaps"]

    asyncio.run(run_test())


def test_confirm_publish_blocks_unready_sourcing_even_if_marked_publishable(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'confirm-unready-listing.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="店铺", is_active=True)
            item = SourcingItem(
                user_id="user-a", source_name="1688", source_price_rmb=18, selling_price_local=39,
                product_name="绕过预览商品", platform="shopee", market="MY", pipeline_stage="decision_passed",
            )
            session.add_all([account, item])
            await session.commit()

            result = await confirm_publish(session, "user-a", [{
                "confirmed": True,
                "publishable": True,
                "platform": "shopee",
                "sourcing_item_id": item.id,
                "selling_price": 39,
                "template_title": "绕过预览商品",
            }])
            listing_count = len((await session.execute(select(PlatformListing))).scalars().all())
        await engine.dispose()

        assert result[0]["publish_status"] == "skipped"
        assert "sourcing_items.pricing_confirmation" in result[0]["data_gaps"]
        assert listing_count == 0

    asyncio.run(run_test())


def test_confirm_publish_stores_scheduled_local_publish_plan(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'scheduled-local-plan.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        content_tasks = {
            task_type: {"confirmed_version": 1, "versions": [{"version": 1, "content": "已确认"}]}
            for task_type, _label in REQUIRED_CONTENT_GAPS
        }
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="店铺", is_active=True)
            item = SourcingItem(
                user_id="user-a", source_name="1688", source_price_rmb=18, selling_price_local=39,
                product_name="定时刊登商品", platform="shopee", market="MY", pipeline_stage="price_confirmed",
                extra_data={"content_tasks": content_tasks, "pricing_confirmation": {"listing_id": "draft-1"}},
            )
            session.add_all([account, item])
            await session.commit()

            result = await confirm_publish(session, "user-a", [{
                "confirmed": True,
                "publishable": True,
                "platform": "shopee",
                "sourcing_item_id": item.id,
                "selling_price": 39,
                "template_title": "定时刊登商品标题",
            }], publish_plan={"mode": "scheduled", "scheduled_at": "2026-07-02T10:00:00+08:00"})
            listing = (await session.execute(select(PlatformListing))).scalar_one()
        await engine.dispose()

        assert result[0]["publish_status"] == "draft"
        assert result[0]["plan_status"] == "planned"
        assert result[0]["platform_publish_status"] == "not_attempted"
        assert result[0]["publish_plan"]["mode"] == "scheduled"
        assert listing.status == "draft"
        assert listing.platform_data["publish_plan"]["scheduled_at"] == "2026-07-02T10:00:00+08:00"
        assert listing.platform_data["publish_plan"]["status"] == "planned"
        assert listing.platform_data["platform_api_status"] == "not_connected"

    asyncio.run(run_test())


def test_confirm_publish_rejects_scheduled_plan_without_time(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'invalid-local-plan.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        content_tasks = {
            task_type: {"confirmed_version": 1, "versions": [{"version": 1, "content": "已确认"}]}
            for task_type, _label in REQUIRED_CONTENT_GAPS
        }
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="店铺", is_active=True)
            item = SourcingItem(
                user_id="user-a", source_name="1688", source_price_rmb=18, selling_price_local=39,
                product_name="缺时间刊登商品", platform="shopee", market="MY", pipeline_stage="price_confirmed",
                extra_data={"content_tasks": content_tasks, "pricing_confirmation": {"listing_id": "draft-1"}},
            )
            session.add_all([account, item])
            await session.commit()

            result = await confirm_publish(session, "user-a", [{
                "confirmed": True,
                "publishable": True,
                "platform": "shopee",
                "sourcing_item_id": item.id,
                "selling_price": 39,
                "template_title": "缺时间刊登商品标题",
            }], publish_plan={"mode": "scheduled"})
            listings = (await session.execute(select(PlatformListing))).scalars().all()
        await engine.dispose()

        assert result[0]["publish_status"] == "skipped"
        assert "listing_publish_plan.scheduled_at" in result[0]["data_gaps"]
        assert listings == []

    asyncio.run(run_test())


def test_dashboard_platform_and_supply_counts_are_user_scoped(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'dashboard.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            session.add_all([
                TrendingProduct(user_id="user-a", platform="shopee", name="A", discovered_at=now, last_updated=now),
                TrendingProduct(user_id="user-b", platform="shopee", name="B", discovered_at=now, last_updated=now),
                SupplyProduct(user_id="user-a", name="供应A"),
                SupplyProduct(user_id="user-b", name="供应B"),
                TrendKeyword(user_id=None, keyword="系统趋势"),
                TrendKeyword(user_id="user-a", keyword="用户A趋势"),
                TrendKeyword(user_id="user-b", keyword="用户B趋势"),
            ])
            await session.commit()
            summary = await get_dashboard_summary(session, "user-a")
        await engine.dispose()

        assert summary["layer_counts"]["platform"] == 1
        assert summary["layer_counts"]["supply"] == 1
        assert summary["layer_counts"]["trend"] == 2

    asyncio.run(run_test())


def test_inventory_scan_uses_active_confirmed_stock_listing(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'inventory.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="店铺", is_active=True)
            product = Product(user_id="user-a", sku="SKU-A", name="库存商品", cost_price=10)
            session.add_all([account, product])
            await session.flush()
            session.add_all([
                PlatformListing(
                    user_id="user-a", product_id=product.id, platform_account_id=account.id,
                    title="未知库存草稿", price=20, stock=0, status="draft",
                    platform_data={"stock_status": "missing"},
                ),
                PlatformListing(
                    user_id="user-a", product_id=product.id, platform_account_id=account.id,
                    title="真实库存商品", price=20, stock=3, status="active",
                    platform_data={"stock_status": "confirmed"},
                ),
                InventoryAlertRule(
                    user_id="user-a", product_id=product.id, sku=product.sku,
                    product_name=product.name, safety_stock=5, severity="warning",
                ),
            ])
            await session.commit()
            scan = await check_inventory(session, "user-a")
        await engine.dispose()

        assert len(scan["alerts"]) == 1
        assert scan["alerts"][0].current_stock == 3
        assert scan["rules_checked"] == 1
        assert scan["rules_skipped_no_confirmed_stock"] == 0

    asyncio.run(run_test())


def test_shipment_update_persists_method_and_real_cost_ledger(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'shipment.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="店铺", is_active=True)
            session.add(account)
            await session.flush()
            order = Order(
                user_id="user-a", platform_account_id=account.id,
                platform_order_id="ORDER-SHIP", status="processing", total=100, currency="MYR",
                ordered_at=datetime.now(timezone.utc),
            )
            session.add(order)
            await session.flush()
            shipment = Shipment(
                user_id="user-a", platform_account_id=account.id, order_id=order.id,
                carrier="真实承运商", status="draft",
            )
            session.add(shipment)
            await session.commit()

            updated = await update_shipment(
                session, "user-a", shipment,
                ShipmentUpdate(
                    shipping_method="express", tracking_number="TRACK-1",
                    shipping_cost=9.5, actual_weight_g=200,
                ),
            )
            ledger = (await session.execute(select(FinanceLedgerEntry))).scalar_one()
        await engine.dispose()

        assert updated.shipping_method == "express"
        assert updated.tracking_number == "TRACK-1"
        assert updated.actual_weight_g == 200
        assert ledger.entry_type == "shipping_cost"
        assert ledger.amount_rmb == 9.5
        assert ledger.extra["shipment_id"] == shipment.id

    asyncio.run(run_test())


def test_discovery_without_trend_evidence_keeps_score_unknown(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'discovery.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            discovery = ProductDiscovery(
                user_id="user-a", product_name="无趋势证据商品", category="bags", market="MY",
            )
            session.add(discovery)
            await session.commit()
            analyzed = await analyze_discovery(session, discovery.id, "user-a")
        await engine.dispose()

        assert analyzed is not None
        assert analyzed.trend_score is None

    asyncio.run(run_test())


def test_product_batch_stock_route_is_exposed_and_store_scoped(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'batch-stock.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            owned_store = PlatformAccount(user_id="user-a", platform="shopee", account_name="A店", is_active=True)
            other_store = PlatformAccount(user_id="user-b", platform="shopee", account_name="B店", is_active=True)
            product = Product(user_id="user-a", sku="SKU-STOCK-A", name="批量库存商品", images=["https://img.example.com/a.jpg"])
            other_product = Product(user_id="user-a", sku="SKU-STOCK-B", name="不应更新商品", images=["https://img.example.com/b.jpg"])
            session.add_all([owned_store, other_store, product, other_product])
            await session.flush()
            owned_listing = PlatformListing(
                user_id="user-a",
                product_id=product.id,
                platform_account_id=owned_store.id,
                title="A店商品",
                price=19.9,
                stock=3,
                status="active",
            )
            inaccessible_listing = PlatformListing(
                user_id="user-b",
                product_id=product.id,
                platform_account_id=other_store.id,
                title="B店商品",
                price=19.9,
                stock=7,
                status="active",
            )
            unselected_listing = PlatformListing(
                user_id="user-a",
                product_id=other_product.id,
                platform_account_id=owned_store.id,
                title="未选商品",
                price=29.9,
                stock=11,
                status="active",
            )
            session.add_all([owned_listing, inaccessible_listing, unselected_listing])
            await session.commit()

            updated = await batch_update_stock(session, "user-a", [product.id], "set", 18)
            await session.refresh(owned_listing)
            await session.refresh(inaccessible_listing)
            await session.refresh(unselected_listing)
        await engine.dispose()

        assert [item.id for item in updated] == [owned_listing.id]
        assert owned_listing.stock == 18
        assert inaccessible_listing.stock == 7
        assert unselected_listing.stock == 11

    route_paths = {route.path for route in products_router.routes}
    assert "/products/batch/stock" in route_paths
    asyncio.run(run_test())

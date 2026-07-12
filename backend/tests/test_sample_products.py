"""Regression tests for user-triggered real sample product data."""

import asyncio
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import pricing as pricing_api
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.competitor_product import CompetitorProduct
from app.models.content_asset import ContentAsset
from app.models.exchange_rate import ExchangeRate
from app.models.fee_template import FeeTemplate
from app.models.listing_template import ListingTemplate
from app.models.market_research import MarketResearch
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.sourcing_item import SourcingItem
from app.models.sourcing_supplier import SourcingSupplier
from app.models.supply_product import SupplyProduct
from app.models.trend_keyword import TrendKeyword
from app.models.trending_product import TrendingProduct
from app.models.user import User
from app.sample_data.product_validation_pack import SAMPLES
from app.services.batch_publish_service import confirm_publish, generate_listing_drafts, list_publish_ready_items
from app.services.business_flow_service import get_business_flow_overview
from app.services.listing_instance_service import get_product_listing_matrix
from app.services.content_workbench_service import get_content_workbench
from app.services.sample_product_service import seed_sample_products


def test_seed_sample_products_creates_complete_realistic_products_once(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sample-products.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="sample-user", username="sample", email="sample@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            first = await seed_sample_products(session, user.id)
            second = await seed_sample_products(session, user.id)
            products = list((await session.execute(select(Product).where(Product.user_id == user.id))).scalars().all())
            accounts = list((await session.execute(select(PlatformAccount).where(PlatformAccount.user_id == user.id))).scalars().all())
            listings = list((await session.execute(select(PlatformListing).where(PlatformListing.user_id == user.id))).scalars().all())
            sourcing_items = list((await session.execute(select(SourcingItem).where(SourcingItem.user_id == user.id))).scalars().all())
            suppliers = list((await session.execute(select(SourcingSupplier).where(SourcingSupplier.user_id == user.id))).scalars().all())
            supply_products = list((await session.execute(select(SupplyProduct).where(SupplyProduct.user_id == user.id))).scalars().all())
            trends = list((await session.execute(select(TrendKeyword).where(TrendKeyword.user_id == user.id))).scalars().all())
            trending_products = list((await session.execute(select(TrendingProduct).where(TrendingProduct.user_id == user.id))).scalars().all())
            competitors = list((await session.execute(select(CompetitorProduct).where(CompetitorProduct.user_id == user.id))).scalars().all())
            research = list((await session.execute(select(MarketResearch).where(MarketResearch.user_id == user.id))).scalars().all())
            assets = list((await session.execute(select(ContentAsset).where(ContentAsset.user_id == user.id))).scalars().all())
            templates = list((await session.execute(select(ListingTemplate).where(ListingTemplate.user_id == user.id))).scalars().all())
            fees = list((await session.execute(select(FeeTemplate))).scalars().all())
            rates = list((await session.execute(select(ExchangeRate))).scalars().all())
            content_workbench = await get_content_workbench(session, user.id)
            pricing_workbench = await pricing_api.get_pricing_workbench(
                current_user=SimpleNamespace(id=user.id, is_admin=False),
                db=session,
            )
            listing_ready = await list_publish_ready_items(session, user.id)
            ready_platform_account_ids = [
                account.id
                for account in accounts
                if account.platform == listing_ready[0]["platform"]
            ]
            draft_preview = await generate_listing_drafts(
                db=session,
                user_id=user.id,
                sourcing_item_ids=[listing_ready[0]["id"]],
                platforms=[listing_ready[0]["platform"]],
                markets=[listing_ready[0]["market"]],
                pricing_mode="selling_based",
                target_profit_pct=20,
                platform_account_ids=ready_platform_account_ids,
            )
            business_flow = await get_business_flow_overview(session, user.id, user)

        await engine.dispose()

        assert first["created_count"] == 8
        assert first["skipped_count"] == 0
        assert second["created_count"] == 0
        assert second["skipped_count"] == 8
        assert first["sample_count"] == 8
        assert first["created_counts"] == {
            "products": 8,
            "platform_accounts": 4,
            "platform_listings": 8,
            "sourcing_items": 8,
            "sourcing_suppliers": 8,
            "supply_products": 8,
            "trend_keywords": 8,
            "trending_products": 8,
            "competitor_products": 8,
            "market_research": 8,
            "content_assets": 16,
            "listing_templates": 3,
            "fee_templates": 8,
            "exchange_rates": 6,
        }
        assert len(products) == 8
        assert len(accounts) == 4
        assert len(listings) == 8
        assert len(sourcing_items) == 8
        assert len(suppliers) == 8
        assert len(supply_products) == 8
        assert len(trends) == 8
        assert len(trending_products) == 8
        assert len(competitors) == 8
        assert len(research) == 8
        assert len(assets) == 16
        assert len(templates) == 3
        assert len(fees) >= 8
        assert len(rates) >= 6
        target_platforms = {"shopee", "temu", "tiktok"}
        account_platform_by_id = {account.id: account.platform for account in accounts}
        assert target_platforms.issubset({product.attributes["target_platforms"][0] for product in products})
        assert target_platforms.issubset({item.platform for item in sourcing_items})
        assert target_platforms.issubset({account_platform_by_id[listing.platform_account_id] for listing in listings})
        assert all(product.cost_price and product.weight_g and product.dimensions for product in products)
        assert all(product.attributes.get("target_markets") for product in products)
        assert all(product.attributes.get("listing_inputs") for product in products)
        assert all(product.attributes.get("sourcing_evidence") for product in products)
        assert all(product.attributes.get("decision_inputs") for product in products)
        assert all(product.attributes.get("platform_requirements") for product in products)
        assert all({"shopee", "temu", "tiktok"}.issubset(product.attributes["platform_requirements"]) for product in products)
        assert all(product.images and product.images[0].startswith("https://") for product in products)
        assert all("/sample-assets/validation/" not in product.images[0] for product in products)
        assert all(product.attributes["listing_inputs"]["image_count"] == len(product.images) for product in products)
        assert all(product.attributes["listing_inputs"]["min_platform_images"] == 5 for product in products)
        assert all(product.attributes["listing_inputs"]["recommended_platform_images"] == 9 for product in products)
        assert all(product.attributes["listing_inputs"]["media_gaps"] for product in products if len(product.images) < 5)
        assert all(product.attributes.get("image_evidence", {}).get("source_page_url") for product in products)
        assert all(product.attributes.get("platform_product_evidence", {}).get("target_platform_search_url") for product in products)
        assert all(product.attributes.get("content_workbench") for product in products)
        assert all(item.extra_data.get("workflow") for item in sourcing_items)
        assert all(item.extra_data.get("ai_assist_tasks") for item in sourcing_items)
        assert all(item.extra_data.get("platform_requirements") for item in sourcing_items)
        assert all(item.extra_data.get("media_readiness", {}).get("captured_image_count") == 1 for item in sourcing_items)
        assert all(item.extra_data.get("media_readiness", {}).get("missing_image_count") == 4 for item in sourcing_items)
        assert all(item.source_url and "sample/" not in item.source_url for item in sourcing_items)
        assert all(item.source_image and item.source_image.startswith("https://") for item in sourcing_items)
        assert any(item.pipeline_stage == "content_required" for item in sourcing_items)
        assert any(item.pipeline_stage == "pricing_required" for item in sourcing_items)
        assert any(item.pipeline_stage == "price_confirmed" for item in sourcing_items)
        assert all(item.extra_data.get("content_tasks") for item in sourcing_items)
        assert all(item.selling_price_local for item in sourcing_items)
        assert all(product.images for product in products)
        assert content_workbench["status"] == "ready"
        assert content_workbench["metrics"]["total"] >= 5
        assert pricing_workbench.status == "ready"
        assert pricing_workbench.data["metrics"]["total"] >= 6
        assert target_platforms.issubset({item["platform"] for item in pricing_workbench.data["items"]})
        assert all(item["image_url"].startswith("https://") for item in pricing_workbench.data["items"])
        assert all(item["source_url"].startswith("http://detail.1688.com/offer/") for item in pricing_workbench.data["items"])
        assert all(item["platform_requirements"]["required_attributes"] for item in pricing_workbench.data["items"])
        assert len(listing_ready) >= 3
        assert target_platforms.issubset({item["platform"] for item in listing_ready})
        assert draft_preview and draft_preview[0]["publishable"] is True
        assert draft_preview[0]["platform_requirements"]["required_attributes"]
        assert all(len(listing.images) == listing.platform_data["media_readiness"]["captured_image_count"] for listing in listings)
        assert all(listing.platform_data["media_readiness"]["missing_image_count"] == 4 for listing in listings)
        assert "example.com" not in draft_preview[0]["source_refs"][0]["label"]
        assert business_flow["metrics"]["item_count"] >= 8
        assert any(item["type"] == "sourcing_item" and item["source_refs"] for item in business_flow["items"])
        assert any(item["type"] == "supply_product" and item["source_refs"] for item in business_flow["items"])
        assert any(item["stage_key"] == "listing" for item in business_flow["items"])
        assert any(
            item["type"] == "sourcing_item"
            and item.get("image_url", "").startswith("https://cbu01.alicdn.com/")
            and item.get("source_url", "").startswith("http://detail.1688.com/offer/")
            for item in business_flow["items"]
        )

    asyncio.run(run_test())


def test_sample_products_can_form_multi_platform_store_listing_matrix(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sample-matrix.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="sample-user", username="sample", email="sample@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            await seed_sample_products(session, user.id)
            product = (await session.execute(select(Product).where(Product.user_id == user.id).order_by(Product.sku))).scalars().first()
            accounts = list((await session.execute(select(PlatformAccount).where(PlatformAccount.user_id == user.id))).scalars().all())
            accounts_by_platform: dict[str, list[PlatformAccount]] = {}
            for account in accounts:
                accounts_by_platform.setdefault(account.platform, []).append(account)

            assert len(accounts_by_platform["shopee"]) >= 2
            platform_markets = {"shopee": "MY", "temu": "MY", "tiktok": "TH"}
            confirmed_drafts = []
            for platform, market in platform_markets.items():
                platform_accounts = accounts_by_platform[platform]
                drafts = await generate_listing_drafts(
                    db=session,
                    user_id=user.id,
                    sourcing_item_ids=[],
                    product_ids=[product.id],
                    platforms=[platform],
                    markets=[market],
                    pricing_mode="cost_based",
                    target_profit_pct=20,
                    platform_account_ids=[account.id for account in platform_accounts],
                )
                assert len(drafts) == len(platform_accounts)
                assert all(draft["publishable"] for draft in drafts)
                for index, draft in enumerate(drafts):
                    draft["confirmed"] = True
                    draft["template_title"] = f"{platform.upper()} 店铺{index + 1} {product.name}"
                    confirmed_drafts.append(draft)

            result = await confirm_publish(session, user.id, confirmed_drafts)
            matrix = await get_product_listing_matrix(session, user.id, product.id)

        await engine.dispose()

        assert all(item["publish_status"] == "draft" for item in result)
        assert matrix is not None
        instance_platforms = {item["platform"] for item in matrix["listing_instances"]}
        shopee_store_ids = {
            item["store"]["id"]
            for item in matrix["listing_instances"]
            if item["platform"] == "shopee"
        }
        assert {"shopee", "temu", "tiktok"}.issubset(instance_platforms)
        assert len(shopee_store_ids) >= 2
        assert len({item["id"] for item in matrix["listing_instances"]}) >= 4
        assert matrix["rules"]["store_override_isolation"] is True
        assert matrix["rules"]["master_update_requires_explicit_action"] is True
        assert all(item["platform_requirements"] for item in matrix["listing_instances"])
        assert any(item["platform_requirements"].get("category_profile") for item in matrix["listing_instances"])
        assert any(
            any(str(group.get("id", "")).startswith("category_profile_") for group in item["platform_requirements"].get("field_groups", []))
            for item in matrix["listing_instances"]
        )

    asyncio.run(run_test())


def test_sample_seed_keeps_listing_instances_store_scoped(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sample-store-scope.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="sample-user", username="sample", email="sample@example.com", hashed_password="x")
            sample = SAMPLES[0]
            sku = f"CBH-{user.id[:8].upper()}-{sample['suffix']}"
            product = Product(
                user_id=user.id,
                sku=sku,
                name="预置商品主档",
                description="用于验证样本播种不得污染非目标店铺 Listing。",
                cost_price=sample["cost"],
                images=[sample["image"]],
                attributes={},
                status="draft",
            )
            unrelated_account = PlatformAccount(
                user_id=user.id,
                platform="temu",
                account_name="预置 TEMU 店铺",
                shop_id="preexisting-temu-store",
                is_active=True,
            )
            session.add_all([user, product, unrelated_account])
            await session.flush()
            unrelated_listing = PlatformListing(
                user_id=user.id,
                product_id=product.id,
                platform_account_id=unrelated_account.id,
                platform_product_id="preexisting-temu-listing",
                title="非目标店铺 Listing 不应被样本覆盖",
                description="保留原店铺覆盖。",
                price=99,
                stock=3,
                status="draft",
                platform_data={"listing_overrides": {"title": "custom"}},
            )
            session.add(unrelated_listing)
            await session.commit()

            await seed_sample_products(session, user.id)

            sample_accounts = list((await session.execute(
                select(PlatformAccount).where(PlatformAccount.user_id == user.id)
            )).scalars().all())
            shopee_account_ids = {account.id for account in sample_accounts if account.platform == sample["platform"]}
            product_listings = list((await session.execute(
                select(PlatformListing).where(PlatformListing.user_id == user.id, PlatformListing.product_id == product.id)
            )).scalars().all())
            unrelated_after = next(item for item in product_listings if item.id == unrelated_listing.id)

        await engine.dispose()

        assert any(item.platform_account_id in shopee_account_ids for item in product_listings)
        assert unrelated_after.title == "非目标店铺 Listing 不应被样本覆盖"
        assert unrelated_after.platform_product_id == "preexisting-temu-listing"

    asyncio.run(run_test())

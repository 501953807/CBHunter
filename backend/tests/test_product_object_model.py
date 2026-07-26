"""Tests for V5 product object model persistence."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.services.product_object_model_service import (
    create_product_base_version,
    product_object_snapshot,
    record_platform_field_validations,
    upsert_product_sku_variants,
)


def test_v5_product_object_model_keeps_base_and_store_listing_isolated(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-object-model.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            product = Product(
                user_id="user-v5",
                sku="BASE-BAG-001",
                name="CocoTrip Nylon Crossbody Bag",
                description="基础版本商品描述",
                brand="CocoTrip",
                cost_price=18.5,
                weight_g=620,
                dimensions={"length_cm": 28, "width_cm": 10, "height_cm": 18},
                attributes={"material": "nylon", "origin": "1688"},
                images=["/api/v1/content/assets/base-main/file"],
                tags=["bag", "nylon"],
                status="active",
            )
            session.add(product)
            await session.flush()
            account = PlatformAccount(
                id="store-shopee-my",
                user_id="user-v5",
                platform="shopee",
                account_name="Shopee MY 主店",
                shop_id="MY-001",
                settings={"market": "MY"},
                is_active=True,
            )
            session.add(account)

            base_version = await create_product_base_version(
                session,
                "user-v5",
                product,
                source="selection_decision",
                change_reason="绿灯选品进入内容制作",
            )
            base_skus = await upsert_product_sku_variants(
                session,
                user_id="user-v5",
                product_id=product.id,
                base_version_id=base_version.id,
                scope="base",
                rows=[{
                    "merchant_sku": "BASE-BAG-001-BLACK",
                    "option_1_value": "Black",
                    "option_2_value": "Standard",
                    "price": 39.9,
                    "stock": 120,
                    "weight_g": 620,
                    "dimensions": {"length_cm": 28, "width_cm": 10, "height_cm": 18},
                }],
            )
            listing = PlatformListing(
                user_id="user-v5",
                product_id=product.id,
                platform_account_id="store-shopee-my",
                platform_product_id="shopee-local-draft-1",
                platform_category_id="bags.crossbody",
                title="Shopee MY 店铺专用标题",
                description="店铺覆盖描述",
                price=49.9,
                stock=80,
                variations=[],
                images=["/api/v1/content/assets/shopee-main/file"],
                shipping_config={"warehouse": "MY-local"},
                status="draft",
                platform_data={"market": "MY", "override_boundary": "store_listing_instance"},
            )
            session.add(listing)
            await session.flush()
            listing_skus = await upsert_product_sku_variants(
                session,
                user_id="user-v5",
                product_id=product.id,
                platform_listing_id=listing.id,
                scope="listing_override",
                rows=[{
                    "merchant_sku": "BASE-BAG-001-BLACK",
                    "platform_sku": "SHP-MY-BAG-BLACK",
                    "spu": "SPU-BAG-001",
                    "skc": "SKC-BLACK",
                    "option_1_value": "Black",
                    "option_2_value": "Gift Set",
                    "sku_image_url": "/api/v1/content/assets/sku-black/file",
                    "price": 49.9,
                    "stock": 80,
                    "weight_g": 650,
                    "dimensions": {"length_cm": 30, "width_cm": 12, "height_cm": 20},
                }],
            )
            validations = await record_platform_field_validations(
                session,
                user_id="user-v5",
                product_id=product.id,
                platform_listing_id=listing.id,
                platform_account_id="store-shopee-my",
                platform="shopee",
                market="MY",
                category_id="bags.crossbody",
                fields=[
                    {"field_key": "brand", "platform_field_name": "Brand", "requirement_level": "required", "state": "present", "current_value": "CocoTrip"},
                    {"field_key": "material", "platform_field_name": "Material", "requirement_level": "required", "state": "missing", "issue_code": "required_missing"},
                ],
            )
            await session.commit()

            snapshot = await product_object_snapshot(session, "user-v5", product.id)

        await engine.dispose()

        assert base_version.title == "CocoTrip Nylon Crossbody Bag"
        assert base_skus[0].scope == "base"
        assert listing_skus[0].platform_sku == "SHP-MY-BAG-BLACK"
        assert validations[1].field_key == "material"
        assert snapshot["product"]["name"] == "CocoTrip Nylon Crossbody Bag"
        assert snapshot["summary"]["base_version_count"] == 1
        assert snapshot["summary"]["listing_instance_count"] == 1
        assert snapshot["summary"]["sku_variant_count"] == 2
        assert snapshot["summary"]["missing_required_field_count"] == 1
        assert snapshot["base_versions"][0]["title"] == "CocoTrip Nylon Crossbody Bag"
        assert snapshot["listing_instances"][0]["title"] == "Shopee MY 店铺专用标题"
        assert snapshot["listing_instances"][0]["platform"] == "shopee"
        assert snapshot["listing_instances"][0]["store_name"] == "Shopee MY 主店"
        assert {row["scope"] for row in snapshot["sku_variants"]} == {"base", "listing_override"}
        assert any(row["field_key"] == "material" and row["state"] == "missing" for row in snapshot["field_validations"])
        assert "存在平台必填字段未完成" in snapshot["data_gaps"]
        assert snapshot["rules"]["listing_override_does_not_mutate_base"] is True

    asyncio.run(run_test())

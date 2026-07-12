"""Browser collection API evidence-chain regression tests."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.api.v1 import collect as collect_api
from app.database import Base
from app.models.supply_product import SupplyProduct
from app.models.sys_dict import SysDictItem
from app.models.trending_product import TrendingProduct
from app.models import all_models  # noqa: F401
from app.models.user import User


async def _create_test_session(tmp_path, name: str):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / name}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return engine, sessions


async def _seed_platform_dictionary(session):
    session.add_all([
        SysDictItem(id="shopee", type="platform", label="Shopee", extra={"id": "shopee"}, sort_order=1, is_active=True),
        SysDictItem(id="temu", type="platform", label="TEMU", extra={"id": "temu"}, sort_order=2, is_active=True),
        SysDictItem(id="tiktok", type="platform", label="TikTok Shop", extra={"id": "tiktok"}, sort_order=3, is_active=True),
    ])
    await session.commit()


def test_unified_collect_missing_1688_fields_promotes_data_required_to_api_response(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'collect-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="collect-user", username="collect", email="collect@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            response = await collect_api.collect_product_unified(
                collect_api.UnifiedCollectRequest(
                    source_platform="1688",
                    source_url="",
                    title="",
                    price=None,
                    currency="CNY",
                ),
                current_user=user,
                db=session,
            )

        await engine.dispose()

        assert response.status == "data_required"
        assert response.evidence_window == "浏览器扩展当前采集结果"
        assert set(response.data_gaps) == {"source_url", "title", "price"}
        assert response.data["status"] == "data_required"

    asyncio.run(run_test())


def test_unified_collect_platform_product_preserves_extension_evidence(tmp_path):
    async def run_test():
        engine, sessions = await _create_test_session(tmp_path, "platform-evidence.db")

        async with sessions() as session:
            user = User(id="collect-platform-user", username="platform", email="platform@example.com", hashed_password="x")
            session.add(user)
            await session.commit()
            await _seed_platform_dictionary(session)

            response = await collect_api.collect_product_unified(
                collect_api.UnifiedCollectRequest(
                    source_platform="shopee",
                    source_url="https://shopee.com.my/product/10/20",
                    title="真实 Shopee 编织包",
                    price=19.9,
                    currency="MYR",
                    images=["https://img.example.com/1.jpg", "https://img.example.com/2.jpg"],
                    extra={
                        "market": "MY",
                        "sales": 1234,
                        "rating": 4.8,
                        "review_count": 82,
                        "shop_name": "Kuala Craft Store",
                        "category_path": "Women Bags > Tote Bags",
                        "product_id": "10.20",
                        "listing_score": 91,
                    },
                ),
                current_user=user,
                db=session,
            )

            product = (await session.execute(select(TrendingProduct))).scalar_one()

        await engine.dispose()

        assert response.data["status"] == "created"
        assert response.data["routed_to"] == "trending_product"
        assert product.platform == "shopee"
        assert product.platform_product_id == "10.20"
        assert product.market == "MY"
        assert product.product_url == "https://shopee.com.my/product/10/20"
        assert product.images == ["https://img.example.com/1.jpg", "https://img.example.com/2.jpg"]
        assert product.sales_volume == 1234
        assert product.rating == 4.8
        assert product.snapshot_data["currency"] == "MYR"
        assert product.snapshot_data["review_count"] == 82
        assert product.snapshot_data["listing_score"] == 91

    asyncio.run(run_test())


def test_unified_collect_supply_product_accepts_1688_alias_and_preserves_supplier_fields(tmp_path):
    async def run_test():
        engine, sessions = await _create_test_session(tmp_path, "supply-evidence.db")

        async with sessions() as session:
            user = User(id="collect-supply-user", username="supply", email="supply@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            response = await collect_api.collect_product_unified(
                collect_api.UnifiedCollectRequest(
                    source_platform="ali1688",
                    source_url="https://detail.1688.com/offer/123.html",
                    title="真实 1688 帆布包",
                    price=18.5,
                    currency="CNY",
                    images=["https://img.example.com/1688.jpg"],
                    extra={
                        "product_id": "123",
                        "supplier_name": "义乌真实箱包厂",
                        "shop_url": "https://shop.1688.com/store.htm",
                        "supplier_rating": "5A",
                        "category_path": "箱包皮具 > 帆布包",
                        "moq": 2,
                        "sales": 860,
                        "price_range_text": "18.50-22.00",
                        "sku": "米白/小号",
                        "specs": {"material": "canvas", "weight_g": 260},
                    },
                ),
                current_user=user,
                db=session,
            )

            product = (await session.execute(select(SupplyProduct))).scalar_one()

        await engine.dispose()

        assert response.data["status"] == "created"
        assert response.data["routed_to"] == "supply_product"
        assert product.platform == "ali1688"
        assert product.platform_product_id == "123"
        assert product.shop_name == "义乌真实箱包厂"
        assert product.shop_url == "https://shop.1688.com/store.htm"
        assert product.supplier_rating == "5A"
        assert product.moq == 2
        assert product.sales_volume == 860
        assert product.sku == "米白/小号"
        assert product.price_range_text == "18.50-22.00"
        assert product.snapshot_data["currency"] == "CNY"
        assert product.snapshot_data["specs"]["material"] == "canvas"

    asyncio.run(run_test())

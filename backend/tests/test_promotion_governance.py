"""Tests for promotion campaign governance summaries."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.services.promotion_service import (
    build_promotion_governance_summary,
    create_promotion_campaign,
    list_promotion_campaigns,
    sync_promotion_campaign,
)


def test_promotion_governance_summary_tracks_campaign_objects_without_listing_pollution(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'promotion-governance.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store = PlatformAccount(
                user_id="user-a",
                platform="shopee",
                account_name="Shopee VN",
                shop_id="shopee-vn-01",
                is_active=True,
                settings={"market": "VN"},
            )
            product_a = Product(user_id="user-a", sku="PROMO-GOV-A", name="促销治理商品A", cost_price=20)
            product_b = Product(user_id="user-a", sku="PROMO-GOV-B", name="促销治理商品B", cost_price=30)
            session.add_all([store, product_a, product_b])
            await session.flush()
            listing_a = PlatformListing(
                user_id="user-a",
                product_id=product_a.id,
                platform_account_id=store.id,
                platform_product_id="SP-A",
                title="促销治理商品A Listing",
                description="",
                price=100,
                stock=50,
                status="active",
                platform_data={"listing_overrides": {"title": "keep"}},
            )
            listing_b = PlatformListing(
                user_id="user-a",
                product_id=product_b.id,
                platform_account_id=store.id,
                platform_product_id="SP-B",
                title="促销治理商品B Listing",
                description="",
                price=80,
                stock=40,
                status="active",
            )
            session.add_all([listing_a, listing_b])
            await session.commit()

            await create_promotion_campaign(session, "user-a", {
                "platform_account_id": store.id,
                "name": "Shopee VN 新品折扣",
                "promotion_type": "coupon",
                "status": "draft",
                "platform_data": {
                    "marketing_rules": {
                        "rule_schema": "promotion_marketing_rules.v1",
                        "promotion_type": "coupon",
                        "threshold_or_budget": "满99减10，预算500",
                        "purchase_limit_or_flash_stock": "每人1张",
                        "platform_sync_state": "local_rules_not_synced",
                    },
                    "marketing_watermark": {
                        "binding_schema": "promotion_watermark_binding.v1",
                        "watermark_template_id": "wm-template-01",
                        "watermark_scope": "all_publish_images",
                        "application_state": "local_watermark_not_applied",
                    },
                },
                "items": [
                    {"platform_listing_id": listing_a.id, "discount_value": 10, "stock_limit": 20},
                    {"platform_listing_id": listing_b.id, "discount_value": 15, "stock_limit": 10},
                ],
            })
            campaigns = await list_promotion_campaigns(session, "user-a")
            sync_result = await sync_promotion_campaign(session, "user-a", campaigns[0]["id"])
            campaigns = await list_promotion_campaigns(session, "user-a")
            summary = build_promotion_governance_summary(campaigns)
            listing_a_after = await session.get(PlatformListing, listing_a.id)
        await engine.dispose()

        assert summary["campaign_count"] == 1
        assert summary["platform_count"] == 1
        assert summary["store_count"] == 1
        assert summary["participating_item_count"] == 2
        assert summary["priced_item_count"] == 2
        assert summary["discount_amount_total"] == 22
        assert summary["platform_sync_gap_count"] == 1
        assert summary["runtime_boundary"] == "promotion_campaign_local_object_not_platform_success"
        assert summary["platform_counts"] == {"shopee": 1}
        assert summary["status_counts"] == {"draft": 1}
        assert summary["type_counts"] == {"coupon": 1}
        assert campaigns[0]["platform_data"]["marketing_rules"]["threshold_or_budget"] == "满99减10，预算500"
        assert campaigns[0]["platform_data"]["marketing_rules"]["platform_sync_state"] == "local_rules_not_synced"
        assert campaigns[0]["platform_data"]["marketing_watermark"]["watermark_template_id"] == "wm-template-01"
        assert campaigns[0]["platform_data"]["marketing_watermark"]["application_state"] == "local_watermark_not_applied"
        assert sync_result["status"] == "configuration_required"
        assert "promotion_open_api.not_implemented" in sync_result["data_gaps"]
        assert "platform_operation.marketing_not_implemented" in sync_result["data_gaps"]
        assert campaigns[0]["platform_data"]["promotion_platform_sync"]["schema"] == "promotion_platform_sync_attempt.v1"
        assert campaigns[0]["platform_data"]["promotion_platform_sync"]["marketing_operation_status"] == "not_implemented"
        assert campaigns[0]["platform_data"]["promotion_platform_sync"]["boundary"] == "promotion_open_api_not_executed_without_marketing_operation"
        assert "promotion_config" not in (listing_a_after.platform_data or {}).get("listing_overrides", {})
        assert (listing_a_after.platform_data or {}).get("listing_overrides", {}).get("title") == "keep"

    asyncio.run(run_test())

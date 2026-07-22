"""Pricing adjustment template persistence tests."""

import asyncio
from types import SimpleNamespace

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.settings_fee_rates import (
    PricingAdjustmentTemplateItem,
    get_fee_rates,
    get_pricing_adjustment_templates,
    update_pricing_adjustment_templates,
)
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.fee_template import FeeTemplate


def test_pricing_adjustment_templates_persist_and_flow_into_fee_rates(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'pricing-template.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            session.add(FeeTemplate(
                platform="shopee",
                market="MY",
                commission_pct=8,
                transaction_fee_pct=2,
                tech_service_pct=1,
                vat_pct=0,
                is_active=True,
            ))
            await session.commit()
            admin = SimpleNamespace(id="admin-id", username="admin")
            req = [
                PricingAdjustmentTemplateItem(
                    id="shopee_MY_margin_floor",
                    label="Shopee MY 常规利润保护",
                    platform="shopee",
                    market="MY",
                    shipping_cost_rmb=4.5,
                    activity_discount_pct=8,
                    min_profit_rmb=12,
                    target_profit_pct=25,
                )
            ]

            saved = await update_pricing_adjustment_templates(req, admin, session)
            loaded = await get_pricing_adjustment_templates(admin, session)
            fee_rates = await get_fee_rates(admin, session)

        await engine.dispose()

        expected = {
            "id": "shopee_MY_margin_floor",
            "label": "Shopee MY 常规利润保护",
            "platform": "shopee",
            "market": "MY",
            "shipping_cost_rmb": 4.5,
            "activity_discount_pct": 8,
            "min_profit_rmb": 12,
            "target_profit_pct": 25,
        }
        assert saved.data["templates"] == [expected]
        assert loaded.data["templates"] == [expected]
        assert fee_rates.data["pricing_adjustment_templates"] == [expected]

    asyncio.run(run_test())

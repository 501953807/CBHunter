"""Scout four-layer funnel regression tests."""

import asyncio
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.supply_product import SupplyProduct
from app.models.trending_product import TrendingProduct
from app.models.trend_keyword import TrendKeyword
from app.services.scout_funnel_service import get_signal_funnel
from app.services.signal_service import create_signal


def test_signal_funnel_merges_layers_into_candidate_cards(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'scout-funnel.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            await create_signal(session, "user-a", {
                "layer": "culture",
                "source": "xiaohongshu",
                "title": "折叠收纳包",
                "content": "小红书旅行收纳内容被反复收藏",
                "source_url": "https://www.xiaohongshu.com/explore/example",
            })
            session.add(TrendKeyword(
                user_id="user-a",
                keyword="折叠收纳包",
                market="MY",
                category="travel",
                search_volume=1800,
                trend_direction="rising",
                source="pinterest",
            ))
            session.add(TrendingProduct(
                user_id="user-a",
                platform="shopee",
                platform_product_id="sp-1",
                name="折叠收纳包",
                price_min=4.2,
                price_max=6.8,
                sales_volume=260,
                sales_growth_rate=0.18,
                category_path="Travel",
                market="MY",
                discovered_at=datetime.now(timezone.utc),
                last_updated=datetime.now(timezone.utc),
            ))
            session.add(SupplyProduct(
                user_id="user-a",
                platform="ali1688",
                name="折叠收纳包",
                price_min=8,
                price_max=12,
                category_path="箱包/旅行收纳",
                product_url="https://detail.1688.com/offer/1.html",
            ))
            await session.commit()

            result = await get_signal_funnel(session, "user-a")

        await engine.dispose()
        assert [layer["id"] for layer in result["layers"]] == ["culture", "trend", "platform", "supply"]
        assert result["metrics"]["candidate_count"] == 1
        candidate = result["candidates"][0]
        assert candidate["title"] == "折叠收纳包"
        assert candidate["evidence_summary"] == {"present": 4, "total": 4, "missing": 0}
        assert candidate["missing_layers"] == []
        assert candidate["next_action_route"] == "/product-selection"

    asyncio.run(run_test())


def test_signal_funnel_marks_missing_downstream_evidence(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'scout-funnel-gaps.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            await create_signal(session, "user-a", {
                "layer": "culture",
                "source": "facebook_reels",
                "title": "磁吸理线夹",
                "content": "Facebook Reels 桌面改造内容",
            })

            result = await get_signal_funnel(session, "user-a")

        await engine.dispose()
        candidate = result["candidates"][0]
        assert candidate["evidence_summary"]["present"] == 1
        assert candidate["missing_layers"] == ["流行趋势", "销售平台", "供应渠道"]
        assert candidate["next_action"] == "补齐流行趋势证据"
        assert candidate["next_action_route"] == "/scout/sources"

    asyncio.run(run_test())

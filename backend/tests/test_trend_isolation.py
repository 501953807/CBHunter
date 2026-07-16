"""Regression tests for user-owned trend and captured-keyword records."""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.captured_keyword import CapturedKeyword
from app.models.trend_keyword import TrendKeyword
from app.models.user import User
from app.api.v1.discovery_trends import list_trends
from app.services.captured_keyword_service import delete_captured_keyword, get_captured_keywords
from app.services.trend_persistence import replace_trend_data
from app.services.trend_service import delete_trend_keyword, get_trends_by_category


def test_trend_and_captured_records_are_user_isolated(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'trend-isolation.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            session.add_all([
                TrendKeyword(user_id=None, keyword="系统趋势", source="google_trends", category="bags", market="MY"),
                TrendKeyword(user_id="user-a", keyword="用户A趋势", source="manual", category="bags", market="MY"),
                TrendKeyword(user_id="user-b", keyword="用户B趋势", source="manual", category="bags", market="MY"),
                CapturedKeyword(user_id="user-a", keyword="用户A捕获", category="bags", market="MY"),
                CapturedKeyword(user_id="user-b", keyword="用户B捕获", category="bags", market="MY"),
            ])
            await session.commit()

            trends = await get_trends_by_category(session, "user-a")
            captured = await get_captured_keywords(session, "user-a")
            user_b_trend = (await session.execute(
                select(TrendKeyword).where(TrendKeyword.user_id == "user-b")
            )).scalar_one()
            user_b_capture = (await session.execute(
                select(CapturedKeyword).where(CapturedKeyword.user_id == "user-b")
            )).scalar_one()
            assert not await delete_trend_keyword(session, "user-a", user_b_trend.id)
            assert not await delete_captured_keyword(session, user_b_capture.id, "user-a")
        await engine.dispose()

        visible_trends = {
            row["keyword"]
            for markets in trends["by_category"].values()
            for rows in markets.values()
            for row in rows
        }
        assert visible_trends == {"系统趋势", "用户A趋势"}
        assert captured["total_keywords"] == 1

    asyncio.run(run_test())


def test_trend_list_endpoint_returns_evidence_and_gaps(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'trend-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(id="user-a", username="trend-user", email="trend@example.com", hashed_password="x")
            session.add_all([
                user,
                TrendKeyword(
                    user_id="user-a",
                    keyword="桌面收纳",
                    source="manual",
                    category="home",
                    market="MY",
                    search_volume=120,
                ),
            ])
            await session.commit()

            response = await list_trends(None, None, user, session)
        await engine.dispose()

        assert response.status == "ready"
        assert response.evidence_window == "当前趋势关键词库快照"
        assert response.confidence_reason
        assert response.source_refs[0].type == "trend_keyword"
        assert response.source_refs[0].label == "桌面收纳"
        assert response.data_gaps == []

    asyncio.run(run_test())


def test_system_trend_refresh_preserves_manual_user_records(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'trend-refresh.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            session.add_all([
                TrendKeyword(user_id=None, keyword="旧系统趋势", source="google_trends"),
                TrendKeyword(user_id=None, keyword="旧系统手工词", source="manual"),
                TrendKeyword(user_id="user-a", keyword="用户手工词", source="manual"),
            ])
            await session.commit()
            await replace_trend_data(session, [{
                "keyword": "新系统趋势",
                "market": "MY",
                "category": "bags",
                "source": "google_trends",
                "trend_data": [20, 30],
            }])
            rows = list((await session.execute(select(TrendKeyword))).scalars().all())
        await engine.dispose()

        assert {row.keyword for row in rows} == {"新系统趋势", "旧系统手工词", "用户手工词"}

    asyncio.run(run_test())

"""Trend sync evidence response regression tests."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.discovery import trigger_trend_fetch
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.user import User


def test_trend_fetch_without_collectable_sources_returns_actionable_data_required(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'trend-sync-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            admin = User(id="trend-admin", username="admin", email="admin@example.com", hashed_password="x", is_admin=True)
            session.add(admin)
            await session.commit()

            response = await trigger_trend_fetch(admin=admin, db=session)

        await engine.dispose()
        assert response.status == "data_required"
        assert response.evidence_window == "本次趋势同步执行窗口"
        assert "trend_sync.external_sources" in response.data_gaps
        assert response.data["message"] == "无法采集趋势数据"
        assert response.data["next_actions"]

    asyncio.run(run_test())

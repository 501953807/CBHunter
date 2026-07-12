"""Analytics API evidence-chain regression tests."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import analytics as analytics_api
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.user import User


def test_analytics_dashboard_and_trends_promote_evidence_to_api_response(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'analytics-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(id="analytics-user", username="analytics", email="analytics@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            dashboard = await analytics_api.dashboard_kpis(current_user=user, db=session)
            trend = await analytics_api.sales_trend(period="7d", current_user=user, db=session)
        await engine.dispose()

        assert dashboard.status == "data_required"
        assert dashboard.evidence_window == "最近30天；环比使用此前30天"
        assert "近30天没有可访问店铺的有效订单" in dashboard.data_gaps
        assert dashboard.data["status"] == "data_required"

        assert trend.status == "data_required"
        assert trend.evidence_window == "最近7天"
        assert trend.data_gaps == ["最近7天没有有效订单"]
        assert trend.data["status"] == "data_required"

    asyncio.run(run_test())

"""API-level evidence contract for the three control centers."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import business_flow as business_flow_api
from app.api.v1 import dashboard as dashboard_api
from app.api.v1 import risk_control as risk_control_api
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.user import User


def test_control_center_overviews_promote_evidence_to_api_response(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'control-centers.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="user-centers", username="ops", email="ops@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            cockpit = await dashboard_api.operating_cockpit(
                start_date=None,
                end_date=None,
                platform=None,
                market=None,
                platform_account_id=None,
                currency=None,
                current_user=user,
                db=session,
            )
            risk = await risk_control_api.risk_control_overview(current_user=user, db=session)
            flow = await business_flow_api.business_flow_overview(current_user=user, db=session)
            blue_ocean = await dashboard_api.blue_ocean_radar(
                market=None,
                category=None,
                limit=10,
                current_user=user,
                db=session,
            )

        await engine.dispose()

        assert cockpit.status == "data_required"
        assert cockpit.evidence_window
        assert cockpit.data_gaps
        assert cockpit.data["data_status"] == "data_required"

        assert risk.status == "data_required"
        assert risk.evidence_window == cockpit.evidence_window
        assert risk.data_gaps
        assert risk.data["assessment_status"] == "insufficient"

        assert flow.status == "data_required"
        assert flow.evidence_window == cockpit.evidence_window
        assert flow.data_gaps
        assert flow.data["metrics"]["data_required"] == flow.data["metrics"]["stage_count"]

        assert blue_ocean.status == "data_required"
        assert blue_ocean.evidence_window == "当前趋势词、选品库成本利润和供应链信号快照"
        assert "trend_keywords" in blue_ocean.data_gaps
        assert blue_ocean.data["status"] == "data_required"

    asyncio.run(run_test())

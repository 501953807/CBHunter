"""Smart API evidence-chain regression tests."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import smart as smart_api
from app.database import Base
from app.models import all_models  # noqa: F401


def test_profit_calculator_missing_markup_promotes_data_required_to_api_response(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'smart-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            response = await smart_api.profit_calculator(
                {"cost_rmb": 10, "shipping_rmb": 5},
                db=session,
            )

        await engine.dispose()

        assert response.status == "data_required"
        assert response.evidence_window == "当前请求输入"
        assert response.data_gaps == ["markup_pct"]
        assert response.data["status"] == "data_required"
        assert response.data["results"] == []

    asyncio.run(run_test())

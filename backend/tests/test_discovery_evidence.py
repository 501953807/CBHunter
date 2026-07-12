"""Discovery API evidence-chain regression tests."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import discovery as discovery_api
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.user import User


def test_discovery_recommend_missing_ai_key_promotes_configuration_required(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'discovery-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="discovery-user", username="discovery", email="discovery@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            response = await discovery_api.ai_recommend(
                discovery_api.RecommendRequest(prompt="分析这个商品机会"),
                current_user=user,
                db=session,
            )

        await engine.dispose()

        assert response.status == "configuration_required"
        assert response.evidence_window == "当前系统配置"
        assert response.data_gaps == ["system_config.gemini_api_key"]
        assert response.data["status"] == "configuration_required"

    asyncio.run(run_test())

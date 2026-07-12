"""Regression tests for seeded system role permissions."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.services.permission_service import list_access_control_matrix, seed_default_permissions


def test_system_roles_are_seeded_with_default_permissions(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'permissions.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            await seed_default_permissions(session)
            matrix = await list_access_control_matrix(session)

        await engine.dispose()

        roles = {item["code"]: set(item["permissions"]) for item in matrix["roles"]}
        all_permissions = {item["code"] for item in matrix["permissions"]}
        assert roles["owner"] == all_permissions
        assert {"business_flow.read", "listing.write", "orders.write"} <= roles["operator"]
        assert {"finance.read", "finance.write", "reports.read"} <= roles["finance"]
        assert roles["operator"]
        assert roles["finance"]

    asyncio.run(run_test())

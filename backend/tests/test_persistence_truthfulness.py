"""Regression tests for persistent user data and explicit missing values."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.services.signal_service import create_signal, list_signals
from app.services.sourcing_service import create_item


def test_culture_signals_persist_with_user_isolation(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'signals.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            await create_signal(session, "user-a", {
                "layer": "culture",
                "source": "reddit",
                "title": "真实文化信号",
                "content": "持久化内容",
            })
            await create_signal(session, "user-b", {
                "layer": "culture",
                "source": "reddit",
                "title": "其他用户信号",
            })
            items, total = await list_signals(session, "user-a", layer="culture")

        await engine.dispose()
        assert total == 1
        assert items[0].title == "真实文化信号"

    asyncio.run(run_test())


def test_missing_sourcing_price_is_marked_explicitly(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sourcing.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            item = await create_item(session, "user-a", {
                "source_name": "trend",
                "product_name": "待询价商品",
                "source_price_rmb": None,
            })

        await engine.dispose()
        assert item.source_price_rmb is None
        assert item.extra_data["source_price_status"] == "missing"

    asyncio.run(run_test())

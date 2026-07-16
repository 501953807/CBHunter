"""Shared database fixtures for backend tests."""

from pathlib import Path

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401 - ensure every table is registered
from app.models.sys_dict import SysDictItem


async def create_sqlite_sessionmaker(db_path: Path | str):
    """Create an isolated SQLite async engine and sessionmaker for tests."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False)


def order_status_item(status_id: str, label: str, allowed_next: list[str], sort_order: int) -> SysDictItem:
    return SysDictItem(
        id=f"order_status_{status_id}",
        type="order_status",
        label=label,
        extra={"value": status_id, "allowed_next": allowed_next},
        sort_order=sort_order,
        is_active=True,
    )


async def seed_order_statuses(session, statuses: list[dict] | None = None) -> None:
    """Seed runtime order status dictionary rows used by the state machine."""
    rows = statuses or [
        {"id": "pending", "label": "待处理", "allowed_next": ["processing", "cancelled"]},
        {"id": "processing", "label": "处理中", "allowed_next": ["shipped", "cancelled"]},
        {"id": "shipped", "label": "已发货", "allowed_next": ["delivered"]},
        {"id": "delivered", "label": "已签收", "allowed_next": []},
        {"id": "cancelled", "label": "已取消", "allowed_next": []},
    ]
    for index, row in enumerate(rows):
        session.add(order_status_item(row["id"], row["label"], row["allowed_next"], index))
    await session.commit()

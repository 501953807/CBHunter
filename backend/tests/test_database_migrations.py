"""Regression tests for local SQLite migrations."""

import asyncio
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app import database
from app.database import Base
from app.models import all_models  # noqa: F401


def test_captured_keyword_migration_is_idempotent(tmp_path, monkeypatch):
    async def run_migration():
        temp_engine = create_async_engine(
            f"sqlite+aiosqlite:///{tmp_path / 'migration.db'}"
        )
        monkeypatch.setattr(database, "engine", temp_engine)

        async with temp_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(
                text(
                    "ALTER TABLE trend_keywords "
                    "ADD COLUMN is_active BOOLEAN DEFAULT 1"
                )
            )
            now = datetime.now(timezone.utc)
            await conn.execute(
                text(
                    """
                    INSERT INTO trend_keywords (
                        id, keyword, market, category, source, is_active,
                        created_at, updated_at
                    ) VALUES (
                        :id, :keyword, :market, :category, :source, :is_active,
                        :created_at, :updated_at
                    )
                    """
                ),
                {
                    "id": "captured-keyword-1",
                    "keyword": "portable blender",
                    "market": "MY",
                    "category": "home",
                    "source": "manual",
                    "is_active": False,
                    "created_at": now,
                    "updated_at": now,
                },
            )

        await database._migrate_captured_keywords()
        await database._migrate_captured_keywords()

        async with temp_engine.begin() as conn:
            columns = {
                row[1]
                for row in (
                    await conn.execute(text("PRAGMA table_info(trend_keywords)"))
                ).fetchall()
            }
            captured_count = (
                await conn.execute(
                    text(
                        "SELECT COUNT(*) FROM captured_keywords "
                        "WHERE id = 'captured-keyword-1'"
                    )
                )
            ).scalar_one()
            trend_count = (
                await conn.execute(
                    text(
                        "SELECT COUNT(*) FROM trend_keywords "
                        "WHERE id = 'captured-keyword-1'"
                    )
                )
            ).scalar_one()

        await temp_engine.dispose()

        assert "is_active" not in columns
        assert captured_count == 1
        assert trend_count == 0

    asyncio.run(run_migration())

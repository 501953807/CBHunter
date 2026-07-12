import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        from app.models import all_models  # noqa
        await conn.run_sync(Base.metadata.create_all)

    await _migrate_sourcing_price_nullable()
    # Run migrations for new columns added after initial table creation
    await _migrate_trend_keyword()
    # Run index migrations
    await _migrate_indexes()
    # Run captured_keywords migration (split from trend_keywords is_active)
    await _migrate_captured_keywords()
    await _migrate_ai_suggestions()
    await _migrate_report_subscriptions()
    await _migrate_competitor_provenance()
    await _seed_access_and_billing_config()


async def _seed_access_and_billing_config():
    """Seed system permissions and commercial plan definitions."""
    from app.services.entitlement_service import seed_subscription_plans
    from app.services.permission_service import seed_default_permissions
    from app.services.sys_dict_service import seed_sys_dict

    async with async_session() as session:
        await seed_sys_dict(session)
        await seed_default_permissions(session)
        await seed_subscription_plans(session)


async def _migrate_sourcing_price_nullable():
    """Allow unknown sourcing prices to remain NULL in existing SQLite databases."""
    if "sqlite" not in settings.database_url:
        return
    from sqlalchemy import MetaData, case, insert, select
    from app.models.sourcing_item import SourcingItem

    async with engine.begin() as conn:
        result = await conn.execute(text("PRAGMA table_info(sourcing_items)"))
        columns = {row[1]: row for row in result.fetchall()}
        price_info = columns.get("source_price_rmb")
        if not price_info or not price_info[3]:
            return

        source_table = SourcingItem.__table__
        temp_metadata = MetaData()
        temp_table = source_table.to_metadata(temp_metadata, name="sourcing_items_new")
        temp_table.indexes.clear()
        await conn.execute(text("DROP TABLE IF EXISTS sourcing_items_new"))
        await conn.run_sync(lambda sync_conn: temp_table.create(sync_conn))
        names = [column.name for column in source_table.columns]
        values = [
            case((source_table.c.source_price_rmb <= 0, None), else_=source_table.c.source_price_rmb)
            if name == "source_price_rmb" else source_table.c[name]
            for name in names
        ]
        await conn.execute(insert(temp_table).from_select(names, select(*values)))
        await conn.execute(text("DROP TABLE sourcing_items"))
        await conn.execute(text("ALTER TABLE sourcing_items_new RENAME TO sourcing_items"))
        logger.info("Migration: sourcing_items.source_price_rmb now allows NULL")


async def _migrate_trend_keyword():
    """Add new columns to trend_keywords table if they don't exist."""
    new_columns = [
        ("pinterest_volume", "INTEGER"),
        ("pinterest_direction", "VARCHAR(20)"),
        ("pinterest_growth", "FLOAT"),
        ("pinterest_trend_data", "JSON"),
        ("has_pinterest_data", "BOOLEAN"),
        ("cross_validation_score", "INTEGER"),
        ("cross_validation_detail", "JSON"),
        ("cross_validated_at", "DATETIME"),
    ]

    async with engine.begin() as conn:
        for col_name, col_type in new_columns:
            try:
                await conn.execute(text(f"ALTER TABLE trend_keywords ADD COLUMN {col_name} {col_type}"))
                logger.info(f"Migration: added column {col_name} to trend_keywords")
            except Exception as exc:
                logger.debug("Trend keyword column migration skipped for %s: %s", col_name, exc)


async def _migrate_indexes():
    """Create indexes on frequently queried columns for existing tables.

    SQLite CREATE INDEX IF NOT EXISTS is safe to run repeatedly.
    """
    indexes = [
        # sourcing_items — filtered heavily in list queries
        ("idx_sourcing_items_pipeline_stage", "sourcing_items", "pipeline_stage"),
        ("idx_sourcing_items_platform", "sourcing_items", "platform"),
        # orders — status filtering
        ("idx_orders_status", "orders", "status"),
        # products — status filtering
        ("idx_products_status", "products", "status"),
        # product_discoveries — pipeline + decision
        ("idx_product_discoveries_status", "product_discoveries", "status"),
        ("idx_product_discoveries_decision", "product_discoveries", "decision"),
        # trend_keywords — category + market combination filter
        ("idx_trend_keywords_category", "trend_keywords", "category"),
        ("idx_trend_keywords_market", "trend_keywords", "market"),
    ]

    async with engine.begin() as conn:
        for idx_name, table, column in indexes:
            try:
                await conn.execute(
                    text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})")
                )
            except Exception as e:
                logger.warning(f"Index migration {idx_name}: {e}")


async def _migrate_captured_keywords():
    """Split captured keywords from trend_keywords.

    - Copy is_active=False rows from trend_keywords to captured_keywords
    - Delete is_active=False rows from trend_keywords
    - Drop is_active column from trend_keywords
    """
    from datetime import datetime, timezone

    async with engine.begin() as conn:
        result = await conn.execute(text("PRAGMA table_info(trend_keywords)"))
        columns = {row[1] for row in result.fetchall()}
    if "is_active" not in columns:
        logger.debug("Captured keyword migration already applied")
        return

    migration_time = datetime.now(timezone.utc)
    async with engine.begin() as conn:
        # Step 1: Copy is_active=False rows to captured_keywords (if table is empty)
        try:
            await conn.execute(text("""
                INSERT OR IGNORE INTO captured_keywords (id, user_id, keyword, market, category,
                    search_volume, trend_direction, growth_pct, competition_level,
                    trend_data, source,
                    pinterest_volume, pinterest_direction, pinterest_growth,
                    pinterest_trend_data, has_pinterest_data,
                    cross_validation_score, cross_validation_detail, cross_validated_at,
                    created_at, updated_at)
                SELECT id, user_id, keyword, market, category,
                    search_volume, trend_direction, growth_pct, competition_level,
                    COALESCE(trend_data, '[]'), source,
                    pinterest_volume, pinterest_direction, pinterest_growth,
                    COALESCE(pinterest_trend_data, '[]'), COALESCE(has_pinterest_data, 0),
                    cross_validation_score, cross_validation_detail, cross_validated_at,
                    COALESCE(last_fetched_at, :migration_time), COALESCE(last_fetched_at, :migration_time)
                FROM trend_keywords
                WHERE is_active = False
            """), {"migration_time": migration_time})
            logger.info("Migration: copied is_active=False keywords to captured_keywords")
        except Exception as e:
            # Column might not exist or table already migrated
            logger.info(f"Migration captured_keywords copy skipped: {e}")

    async with engine.begin() as conn:
        # Step 2: Delete is_active=False rows from trend_keywords
        try:
            await conn.execute(text("DELETE FROM trend_keywords WHERE is_active = False"))
            logger.info("Migration: deleted is_active=False rows from trend_keywords")
        except Exception as exc:
            logger.debug("Captured keyword cleanup skipped: %s", exc)

    async with engine.begin() as conn:
        # Step 3: Drop is_active column from trend_keywords
        try:
            await conn.execute(text("ALTER TABLE trend_keywords DROP COLUMN is_active"))
            logger.info("Migration: dropped is_active column from trend_keywords")
        except Exception as exc:
            # SQLite versions before 3.35.0 don't support DROP COLUMN
            logger.info("Migration: DROP COLUMN unavailable (%s), recreating trend_keywords", exc)
            # Exclude is_active from the recreate
            cols = [
                "id", "user_id", "keyword", "market", "category",
                "search_volume", "trend_direction", "growth_pct", "competition_level",
                "trend_data", "related_top", "related_rising", "source",
                "pinterest_volume", "pinterest_direction", "pinterest_growth",
                "pinterest_trend_data", "has_pinterest_data",
                "cross_validation_score", "cross_validation_detail", "cross_validated_at",
                "last_fetched_at", "created_at", "updated_at",
            ]
            col_list = ", ".join(cols)
            try:
                await conn.execute(text(f"CREATE TABLE trend_keywords_new AS SELECT {col_list} FROM trend_keywords"))
                await conn.execute(text("DROP TABLE trend_keywords"))
                await conn.execute(text("ALTER TABLE trend_keywords_new RENAME TO trend_keywords"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trend_keywords_category ON trend_keywords(category)"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trend_keywords_market ON trend_keywords(market)"))
                logger.info("Migration: trend_keywords recreated without is_active")
            except Exception as e2:
                logger.warning(f"Migration recreate trend_keywords failed: {e2}")


async def _migrate_ai_suggestions():
    """Add provenance columns to ai_suggestions for explainable recommendations."""
    new_columns = [
        ("source_refs", "JSON"),
        ("evidence_window", "VARCHAR(100)"),
        ("confidence_reason", "TEXT"),
    ]
    async with engine.begin() as conn:
        for col_name, col_type in new_columns:
            try:
                await conn.execute(text(f"ALTER TABLE ai_suggestions ADD COLUMN {col_name} {col_type}"))
                logger.info(f"Migration: added column {col_name} to ai_suggestions")
            except Exception as exc:
                logger.debug("AI suggestion provenance migration skipped for %s: %s", col_name, exc)


async def _migrate_report_subscriptions():
    """Add delivery tracking to existing report subscriptions."""
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE report_subscriptions ADD COLUMN last_sent_at DATETIME"))
            logger.info("Migration: added last_sent_at to report_subscriptions")
        except Exception as exc:
            logger.debug("Report subscription migration skipped: %s", exc)


async def _migrate_competitor_provenance():
    """Add currency, market and collection provenance to existing competitors."""
    new_columns = [
        ("currency", "VARCHAR(3)"),
        ("market", "VARCHAR(20)"),
        ("collection_method", "VARCHAR(30)"),
        ("confidence_level", "VARCHAR(20)"),
    ]
    async with engine.begin() as conn:
        for column, column_type in new_columns:
            try:
                await conn.execute(text(f"ALTER TABLE competitor_products ADD COLUMN {column} {column_type}"))
                logger.info("Migration: added competitor_products.%s", column)
            except Exception as exc:
                logger.debug("Competitor provenance migration skipped for %s: %s", column, exc)

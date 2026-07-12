"""Tests for platform store OAuth authorization persistence."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.integrations import status as platform_status
from app.integrations.status import get_platform_connector_status
from app.models import all_models  # noqa: F401
from app.models.platform_account import PlatformAccount
from app.schemas.platform import PlatformAccountAuthorizationUpdate
from app.services.platform_service import update_platform_account_authorization
from app.utils.encryption import decrypt


def test_platform_authorization_update_encrypts_tokens_and_unlocks_status(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'platform-auth.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        original = platform_status.PLATFORM_CONNECTORS["shopee"]
        try:
            platform_status.PLATFORM_CONNECTORS["shopee"] = {
                "implementation_status": "implemented",
                "implemented_operations": ("authenticate", "orders", "products"),
                "required_inputs": (),
                "required_scopes": ("orders", "products"),
            }
            async with sessions() as session:
                account = PlatformAccount(
                    user_id="user-a",
                    platform="shopee",
                    account_name="Shopee A店",
                    shop_id="shop-a",
                    api_key_encrypted="key",
                    api_secret_encrypted="secret",
                    is_active=True,
                )
                session.add(account)
                await session.commit()
                updated = await update_platform_account_authorization(
                    session,
                    account,
                    PlatformAccountAuthorizationUpdate(
                        access_token="access-token",
                        refresh_token="refresh-token",
                        token_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
                        token_scopes=[" orders ", "products", ""],
                    ),
                )
                status = get_platform_connector_status(updated)
        finally:
            platform_status.PLATFORM_CONNECTORS["shopee"] = original
            await engine.dispose()

        assert decrypt(updated.access_token_encrypted) == "access-token"
        assert decrypt(updated.refresh_token_encrypted) == "refresh-token"
        assert updated.token_scopes == ["orders", "products"]
        assert status["authorization_status"] == "authorized"
        assert status["operations"]["orders"] is True
        assert status["operations"]["products"] is True

    asyncio.run(run_test())

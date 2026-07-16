"""Integration contract checks for platform Open API sync readiness."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.integrations.status import (
    PLATFORM_CONNECTORS,
    get_platform_connector_status,
    is_order_sync_ready,
    is_product_sync_ready,
)
from app.models.platform_account import PlatformAccount


def _platform_account(**overrides) -> PlatformAccount:
    data = {
        "id": "store-1",
        "user_id": "user-1",
        "platform": "shopee",
        "account_name": "Shopee MY 店铺",
        "shop_id": "1563850155",
        "api_key_encrypted": "encrypted-key",
        "api_secret_encrypted": "encrypted-secret",
        "access_token_encrypted": "encrypted-access-token",
        "refresh_token_encrypted": "encrypted-refresh-token",
        "token_expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "token_scopes": ["authenticate", "orders", "products"],
        "is_active": True,
        "settings": {"sync_state": {"orders": {"status": "idle"}, "products": {"status": "idle"}}},
    }
    data.update(overrides)
    return PlatformAccount(**data)


def test_not_implemented_connector_blocks_real_sync_even_when_credentials_exist():
    account = _platform_account()

    status = get_platform_connector_status(account)

    assert status["platform"] == "shopee"
    assert status["credentials_stored"] is True
    assert status["connection_status"] == "not_implemented"
    assert status["sync_ready"] is False
    assert is_order_sync_ready(account) is False
    assert is_product_sync_ready(account) is False
    assert {item["id"] for item in status["operation_details"]} >= {"orders", "products", "publish"}


def test_sync_readiness_requires_implemented_operations_and_authorized_tokens(monkeypatch):
    account = _platform_account()
    connector = {
        **PLATFORM_CONNECTORS["shopee"],
        "implementation_status": "implemented",
        "implemented_operations": ("authenticate", "orders", "products"),
        "required_scopes": ("orders", "products"),
    }
    monkeypatch.setitem(PLATFORM_CONNECTORS, "shopee", connector)

    status = get_platform_connector_status(account)

    assert status["connection_status"] == "unverified"
    assert status["authorization_status"] == "authorized"
    assert status["operations"]["orders"] is True
    assert status["operations"]["products"] is True
    assert is_order_sync_ready(account) is True
    assert is_product_sync_ready(account) is True

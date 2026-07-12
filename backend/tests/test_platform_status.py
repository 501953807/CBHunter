"""Tests for truthful platform connector readiness."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.integrations import status as platform_status
from app.integrations.status import get_platform_connector_status, is_order_sync_ready


def _account(**overrides):
    values = {
        "id": "account-1",
        "platform": "shopee",
        "account_name": "主店",
        "shop_id": "shop-1",
        "api_key_encrypted": "encrypted-key",
        "api_secret_encrypted": "encrypted-secret",
        "access_token_encrypted": None,
        "refresh_token_encrypted": None,
        "token_expires_at": None,
        "token_scopes": None,
        "is_active": True,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_registered_but_unimplemented_connector_is_not_sync_ready():
    account = _account()

    status = get_platform_connector_status(account)

    assert status["credentials_stored"] is True
    assert status["connection_status"] == "not_implemented"
    assert status["sync_ready"] is False
    assert is_order_sync_ready(account) is False
    assert not any(status["operations"].values())
    assert status["operation_details"][0]["label"] == "鉴权验证"
    assert status["required_inputs"] == ["官方应用参数", "回调地址", "测试店铺授权"]


def test_missing_credentials_are_reported_before_api_implementation_status():
    status = get_platform_connector_status(_account(api_secret_encrypted=None))

    assert status["credentials_stored"] is False
    assert status["connection_status"] == "credentials_missing"
    assert status["sync_ready"] is False


def test_unknown_platform_is_explicitly_unsupported():
    status = get_platform_connector_status(_account(platform="unknown"))

    assert status["implementation_status"] == "unsupported"
    assert status["connection_status"] == "unsupported"


def test_platform_status_exposes_last_sync_state_from_account_settings():
    status = get_platform_connector_status(_account(settings={
        "sync_state": {
            "products": {
                "status": "success",
                "records_processed": 3,
                "last_completed_at": "2026-07-11T10:00:00+00:00",
            }
        }
    }))

    assert status["sync_state"]["products"]["status"] == "success"
    assert status["last_product_sync_status"] == "success"
    assert status["last_product_sync_at"] == "2026-07-11T10:00:00+00:00"


def test_implemented_connector_requires_store_oauth_authorization_before_sync():
    original = platform_status.PLATFORM_CONNECTORS["shopee"]
    try:
        platform_status.PLATFORM_CONNECTORS["shopee"] = {
            "implementation_status": "implemented",
            "implemented_operations": ("authenticate", "orders", "products"),
            "required_inputs": (),
            "required_scopes": ("orders", "products"),
        }
        status = get_platform_connector_status(_account())
    finally:
        platform_status.PLATFORM_CONNECTORS["shopee"] = original

    assert status["connection_status"] == "authorization_required"
    assert status["authorization_status"] == "not_authorized"
    assert status["authorization"]["access_token_stored"] is False
    assert status["authorization"]["refresh_token_stored"] is False
    assert status["sync_ready"] is False
    assert status["next_action"] == "完成店铺 OAuth 授权并保存访问令牌后再同步。"


def test_expired_store_oauth_token_blocks_sync_with_explicit_status():
    original = platform_status.PLATFORM_CONNECTORS["shopee"]
    try:
        platform_status.PLATFORM_CONNECTORS["shopee"] = {
            "implementation_status": "implemented",
            "implemented_operations": ("authenticate", "orders", "products"),
            "required_inputs": (),
            "required_scopes": ("orders", "products"),
        }
        status = get_platform_connector_status(_account(
            access_token_encrypted="access",
            refresh_token_encrypted="refresh",
            token_expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            token_scopes=["orders", "products"],
        ))
    finally:
        platform_status.PLATFORM_CONNECTORS["shopee"] = original

    assert status["connection_status"] == "authorization_expired"
    assert status["authorization_status"] == "expired"
    assert status["sync_ready"] is False
    assert status["next_action"] == "店铺授权令牌已过期，请重新授权或刷新令牌。"


def test_missing_required_oauth_scope_blocks_specific_operations():
    original = platform_status.PLATFORM_CONNECTORS["shopee"]
    try:
        platform_status.PLATFORM_CONNECTORS["shopee"] = {
            "implementation_status": "implemented",
            "implemented_operations": ("authenticate", "orders", "products"),
            "required_inputs": (),
            "required_scopes": ("orders", "products"),
        }
        status = get_platform_connector_status(_account(
            access_token_encrypted="access",
            refresh_token_encrypted="refresh",
            token_expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            token_scopes=["orders"],
        ))
    finally:
        platform_status.PLATFORM_CONNECTORS["shopee"] = original

    assert status["connection_status"] == "scope_insufficient"
    assert status["authorization_status"] == "scope_insufficient"
    assert status["authorization"]["missing_scopes"] == ["products"]
    assert status["operations"]["orders"] is True
    assert status["operations"]["products"] is False

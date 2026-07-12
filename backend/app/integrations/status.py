"""Truthful platform connector readiness metadata.

Workflow capabilities in the system dictionary describe what CBHunter can
prepare locally. This registry describes which remote Open API operations are
actually implemented and safe to execute.
"""

from datetime import datetime, timezone
from typing import Any

from app.models.platform_account import PlatformAccount


PLATFORM_API_OPERATIONS = (
    "authenticate",
    "orders",
    "products",
    "shipments",
    "tracking",
    "metrics",
    "finance_bills",
    "publish",
)

OPERATION_LABELS = {
    "authenticate": "鉴权验证",
    "orders": "订单分页同步",
    "products": "商品同步",
    "shipments": "物流同步",
    "tracking": "物流回传",
    "metrics": "经营指标同步",
    "finance_bills": "平台账单同步",
    "publish": "商品刊登回写",
}

PLATFORM_CONNECTORS: dict[str, dict[str, Any]] = {
    "shopee": {
        "implementation_status": "not_implemented",
        "implemented_operations": (),
        "required_inputs": ("官方应用参数", "回调地址", "测试店铺授权"),
    },
    "tiktok": {
        "implementation_status": "not_implemented",
        "implemented_operations": (),
        "required_inputs": ("官方应用参数", "回调地址", "测试店铺授权"),
    },
    "temu": {
        "implementation_status": "not_implemented",
        "implemented_operations": (),
        "required_inputs": ("官方应用参数", "回调地址", "测试店铺授权"),
    },
}


def get_platform_connector_status(account: PlatformAccount) -> dict[str, Any]:
    connector = PLATFORM_CONNECTORS.get(account.platform)
    credentials_stored = bool(
        account.shop_id and account.api_key_encrypted and account.api_secret_encrypted
    )
    settings = account.settings if isinstance(getattr(account, "settings", None), dict) else {}
    sync_state = settings.get("sync_state") if isinstance(settings.get("sync_state"), dict) else {}
    product_sync_state = sync_state.get("products") if isinstance(sync_state.get("products"), dict) else {}
    order_sync_state = sync_state.get("orders") if isinstance(sync_state.get("orders"), dict) else {}
    authorization = _authorization_status(account, connector)

    if not account.is_active:
        connection_status = "disabled"
        message = "账号配置已停用"
    elif not connector:
        connection_status = "unsupported"
        message = "该平台尚未注册 Open API 接入器"
    elif not credentials_stored:
        connection_status = "credentials_missing"
        message = "缺少店铺 ID、API Key 或 API Secret"
    elif connector["implementation_status"] != "implemented":
        connection_status = "not_implemented"
        message = "账号配置已保存，但真实 Open API 尚未接通"
    elif authorization["status"] == "not_authorized":
        connection_status = "authorization_required"
        message = "官方应用参数已保存，但店铺 OAuth 授权令牌尚未保存"
    elif authorization["status"] == "expired":
        connection_status = "authorization_expired"
        message = "店铺授权令牌已过期"
    elif authorization["status"] == "scope_insufficient":
        connection_status = "scope_insufficient"
        message = "店铺授权权限范围不足"
    else:
        connection_status = "unverified"
        message = "凭证已保存，等待真实 API 鉴权验证"

    implemented = set(connector.get("implemented_operations", ())) if connector else set()
    granted_scopes = set(authorization.get("token_scopes") or [])
    operation_readiness = {
        operation: operation in implemented and (
            not granted_scopes or operation == "authenticate" or operation in granted_scopes
        )
        for operation in PLATFORM_API_OPERATIONS
    }
    operation_details = [
        {
            "id": operation,
            "label": OPERATION_LABELS[operation],
            "status": "implemented" if operation in implemented else "not_implemented",
        }
        for operation in PLATFORM_API_OPERATIONS
    ]
    sync_ready = bool(
        account.is_active
        and credentials_stored
        and connection_status == "unverified"
        and authorization["status"] == "authorized"
        and operation_readiness["authenticate"]
        and operation_readiness["orders"]
    )
    next_action = _next_action(connector, authorization, connection_status)

    return {
        "account_id": account.id,
        "platform": account.platform,
        "account_name": account.account_name,
        "account_active": account.is_active,
        "credentials_stored": credentials_stored,
        "implementation_status": (
            connector["implementation_status"] if connector else "unsupported"
        ),
        "connection_status": connection_status,
        "authorization_status": authorization["status"],
        "authorization": authorization,
        "sync_ready": sync_ready,
        "operations": operation_readiness,
        "operation_details": operation_details,
        "sync_state": sync_state,
        "last_product_sync_status": product_sync_state.get("status"),
        "last_product_sync_at": product_sync_state.get("last_completed_at") or product_sync_state.get("last_attempt_at"),
        "last_order_sync_status": order_sync_state.get("status"),
        "last_order_sync_at": order_sync_state.get("last_completed_at") or order_sync_state.get("last_attempt_at"),
        "required_inputs": list(connector.get("required_inputs", ())) if connector else [],
        "next_action": next_action,
        "message": message,
    }


def is_order_sync_ready(account: PlatformAccount) -> bool:
    return bool(get_platform_connector_status(account)["sync_ready"])


def is_product_sync_ready(account: PlatformAccount) -> bool:
    status = get_platform_connector_status(account)
    return bool(
        account.is_active
        and status["credentials_stored"]
        and status["connection_status"] == "unverified"
        and status["authorization_status"] == "authorized"
        and status["operations"].get("authenticate")
        and status["operations"].get("products")
    )


def _authorization_status(account: PlatformAccount, connector: dict[str, Any] | None) -> dict[str, Any]:
    access_token_stored = bool(getattr(account, "access_token_encrypted", None))
    refresh_token_stored = bool(getattr(account, "refresh_token_encrypted", None))
    token_expires_at = getattr(account, "token_expires_at", None)
    token_scopes = getattr(account, "token_scopes", None)
    if not isinstance(token_scopes, list):
        token_scopes = []
    required_scopes = list(connector.get("required_scopes", ())) if connector else []
    missing_scopes = [scope for scope in required_scopes if scope not in token_scopes]

    status = "authorized"
    if not access_token_stored or not refresh_token_stored:
        status = "not_authorized"
    elif _is_expired(token_expires_at):
        status = "expired"
    elif token_scopes and missing_scopes:
        status = "scope_insufficient"

    return {
        "status": status,
        "access_token_stored": access_token_stored,
        "refresh_token_stored": refresh_token_stored,
        "token_expires_at": token_expires_at.isoformat() if hasattr(token_expires_at, "isoformat") else None,
        "token_scopes": token_scopes,
        "required_scopes": required_scopes,
        "missing_scopes": missing_scopes if status == "scope_insufficient" else [],
    }


def _is_expired(value: Any) -> bool:
    if not value or not hasattr(value, "timestamp"):
        return False
    expires_at = value
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= datetime.now(timezone.utc)


def _next_action(connector: dict[str, Any] | None, authorization: dict[str, Any], connection_status: str) -> str | None:
    if connector and connector["implementation_status"] != "implemented":
        return "提供官方应用参数、回调地址和测试店铺授权后实施真实 Open API 对接"
    if connection_status == "authorization_required":
        return "完成店铺 OAuth 授权并保存访问令牌后再同步。"
    if connection_status == "authorization_expired":
        return "店铺授权令牌已过期，请重新授权或刷新令牌。"
    if connection_status == "scope_insufficient":
        return "补充授权权限范围：" + "、".join(authorization.get("missing_scopes") or [])
    return None

from datetime import datetime, timezone

from app.integrations.errors import PlatformOperationUnavailable
from app.integrations.factory import PlatformClientFactory
from app.integrations.status import get_platform_connector_status
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.services.batch_publish_receipt_service import (
    LOCAL_PLATFORM_API_STATUS,
    LOCAL_PLATFORM_PUBLISH_STATUS,
    build_official_publish_writeback,
)
from app.utils.encryption import decrypt


async def submit_listing_to_platform_if_ready(
    account: PlatformAccount,
    listing: PlatformListing,
    draft: dict,
    publish_plan: dict,
) -> dict:
    mode = publish_plan.get("mode")
    if mode != "immediate":
        return _not_attempted_writeback(account, listing, f"{mode or 'unknown'} 模式只保存本地计划，不立即提交平台。")

    connector = get_platform_connector_status(account)
    if (
        not connector["credentials_stored"]
        or not connector["operations"].get("publish")
        or connector["authorization_status"] != "authorized"
    ):
        return _not_attempted_writeback(account, listing, connector.get("next_action") or connector["message"])

    client = PlatformClientFactory.get_client(account.platform, account, decrypt)
    if not client:
        return _not_attempted_writeback(account, listing, "该平台客户端未注册，不能提交官方发布。")

    try:
        if not await client.authenticate():
            return _failed_writeback(account, listing, "平台鉴权失败，未提交商品发布。")
        response = await client.publish_product(_publish_payload(account, listing, draft, publish_plan))
    except PlatformOperationUnavailable as exc:
        return _not_attempted_writeback(account, listing, str(exc))
    except Exception as exc:
        return _failed_writeback(account, listing, str(exc))

    official_id = _official_product_id(response)
    if official_id:
        listing.platform_product_id = official_id
    listing.status = response.get("status") or listing.status
    listing.last_synced_at = datetime.now(timezone.utc)
    return build_official_publish_writeback(
        platform_api_status="connected",
        platform_publish_status=response.get("publish_status") or "submitted",
        listing_id=listing.id,
        platform_product_id=listing.platform_product_id,
        platform_account_id=account.id,
        store_name=account.account_name,
        official_response=response,
        written_fields=["platform_product_id", "status", "last_synced_at"],
        next_action="已收到平台发布返回，请在商品仓库继续同步核对平台在线资料。",
    )


def _publish_payload(account: PlatformAccount, listing: PlatformListing, draft: dict, publish_plan: dict) -> dict:
    return {
        "platform": account.platform,
        "shop_id": account.shop_id,
        "listing_id": listing.id,
        "title": listing.title,
        "description": listing.description,
        "price": listing.price,
        "stock": listing.stock,
        "images": listing.images or [],
        "variations": listing.variations or [],
        "shipping_config": listing.shipping_config or {},
        "platform_requirements": draft.get("platform_requirements") or {},
        "publish_plan": publish_plan,
    }


def _official_product_id(response: dict) -> str | None:
    for key in ("platform_product_id", "product_id", "item_id", "listing_id"):
        value = response.get(key) if isinstance(response, dict) else None
        if value:
            return str(value)
    return None


def _not_attempted_writeback(account: PlatformAccount, listing: PlatformListing, next_action: str) -> dict:
    return build_official_publish_writeback(
        platform_api_status=LOCAL_PLATFORM_API_STATUS,
        platform_publish_status=LOCAL_PLATFORM_PUBLISH_STATUS,
        listing_id=listing.id,
        platform_account_id=account.id,
        store_name=account.account_name,
        next_action=next_action,
    )


def _failed_writeback(account: PlatformAccount, listing: PlatformListing, error: str) -> dict:
    return build_official_publish_writeback(
        platform_api_status="connected",
        platform_publish_status="failed",
        listing_id=listing.id,
        platform_account_id=account.id,
        store_name=account.account_name,
        official_response={"error": error},
        next_action="平台发布调用失败，请查看错误后重试。",
    )

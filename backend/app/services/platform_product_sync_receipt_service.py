from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing


def build_platform_product_sync_receipt(
    listing: PlatformListing,
    account: PlatformAccount,
    product_sync_state: dict | None,
) -> dict:
    platform_data = listing.platform_data if isinstance(listing.platform_data, dict) else {}
    raw_data = platform_data.get("raw_data") if isinstance(platform_data.get("raw_data"), dict) else {}
    sync_state = product_sync_state if isinstance(product_sync_state, dict) else {}
    official_product_id = listing.platform_product_id or raw_data.get("product_id") or raw_data.get("item_id")
    return {
        "status": sync_state.get("status") or ("synced" if listing.last_synced_at else "local_draft"),
        "sync_log_id": sync_state.get("sync_log_id"),
        "official_product_id": official_product_id,
        "platform": account.platform,
        "shop_id": account.shop_id,
        "last_attempt_at": sync_state.get("last_attempt_at"),
        "last_completed_at": sync_state.get("last_completed_at") or (listing.last_synced_at.isoformat() if listing.last_synced_at else None),
        "records_processed": sync_state.get("records_processed", 0),
        "records_failed": sync_state.get("records_failed", 0),
        "error_message": sync_state.get("error_message"),
        "error_details": sync_state.get("error_details") or [],
        "raw_field_count": len(raw_data),
        "source": platform_data.get("source", "local_listing"),
        "next_action": _sync_next_action(listing, sync_state),
    }


def _sync_next_action(listing: PlatformListing, sync_state: dict) -> str:
    if sync_state.get("status") in {"failed", "partial_failed"}:
        return "查看同步日志，修正接口凭证、字段映射或平台返回异常后重试。"
    if not listing.platform_product_id:
        return "当前仍是本地店铺 Listing 草稿，接通平台商品 Open API 后提交或同步。"
    if not listing.last_synced_at:
        return "已有平台商品ID但缺最近同步时间，请重新执行商品同步核对平台在线资料。"
    return "已具备平台商品ID和最近同步时间，可继续维护当前店铺 Listing。"

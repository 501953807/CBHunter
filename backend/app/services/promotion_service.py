"""Promotion campaign service.

Promotions are independent campaign objects. A campaign belongs to one
platform/store and contains many participating platform listings/SKUs.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.promotion import PromotionCampaign, PromotionCampaignItem
from app.integrations.errors import PlatformOperationUnavailable
from app.integrations.factory import PlatformClientFactory
from app.integrations.status import get_platform_connector_status
from app.utils.encryption import decrypt


async def create_promotion_campaign(db: AsyncSession, user_id: str, data: dict[str, Any]) -> dict:
    account = await _get_account(db, user_id, str(data.get("platform_account_id") or ""))
    if not account:
        raise ValueError("平台店铺不存在或无权访问")

    campaign = PromotionCampaign(
        user_id=user_id,
        platform_account_id=account.id,
        platform=account.platform,
        name=str(data.get("name") or "").strip()[:200],
        promotion_type=str(data.get("promotion_type") or "discount"),
        status=str(data.get("status") or "draft"),
        starts_at=_parse_datetime(data.get("starts_at")),
        ends_at=_parse_datetime(data.get("ends_at")),
        external_promotion_id=_optional_str(data.get("external_promotion_id")),
        stack_rule=_optional_str(data.get("stack_rule")),
        source=str(data.get("source") or "local"),
        platform_data=data.get("platform_data") if isinstance(data.get("platform_data"), dict) else {},
    )
    if not campaign.name:
        raise ValueError("促销活动名称不能为空")
    db.add(campaign)
    await db.flush()

    await _add_items_to_campaign(db, user_id, campaign, account, data.get("items") or [])
    await db.commit()
    return await get_promotion_campaign(db, user_id, campaign.id) or {}


async def list_promotion_campaigns(db: AsyncSession, user_id: str) -> list[dict]:
    result = await db.execute(
        select(PromotionCampaign, PlatformAccount)
        .join(PlatformAccount, PlatformAccount.id == PromotionCampaign.platform_account_id)
        .where(PromotionCampaign.user_id == user_id)
        .order_by(PromotionCampaign.created_at.desc())
    )
    campaigns = []
    for campaign, account in result.all():
        campaigns.append(await _serialize_campaign(db, campaign, account))
    return campaigns


def build_promotion_governance_summary(campaigns: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a page-level governance summary for local promotion campaigns.

    The summary intentionally describes local campaign objects and known sync gaps.
    It must not imply platform-side promotion success before Open API integration
    returns real platform promotion IDs.
    """

    platform_counts: dict[str, int] = {}
    store_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    item_total = 0
    priced_item_total = 0
    discount_total = 0.0
    sync_gap_total = 0
    local_campaign_total = 0

    for campaign in campaigns:
        platform = str(campaign.get("platform") or "unknown").lower()
        store = campaign.get("store") if isinstance(campaign.get("store"), dict) else {}
        store_id = str(store.get("id") or "unknown")
        status = str(campaign.get("status") or "unknown")
        promotion_type = str(campaign.get("promotion_type") or "discount")
        platform_counts[platform] = platform_counts.get(platform, 0) + 1
        store_counts[store_id] = store_counts.get(store_id, 0) + 1
        status_counts[status] = status_counts.get(status, 0) + 1
        type_counts[promotion_type] = type_counts.get(promotion_type, 0) + 1
        item_total += int(campaign.get("product_count") or 0)
        price_summary = campaign.get("price_summary") if isinstance(campaign.get("price_summary"), dict) else {}
        priced_item_total += int(price_summary.get("priced_item_count") or 0)
        discount_total += float(price_summary.get("discount_amount_total") or 0)
        if campaign.get("source") == "local":
            local_campaign_total += 1
            if not campaign.get("external_promotion_id"):
                sync_gap_total += 1

    return {
        "campaign_count": len(campaigns),
        "platform_count": len(platform_counts),
        "store_count": len(store_counts),
        "participating_item_count": item_total,
        "priced_item_count": priced_item_total,
        "discount_amount_total": round(discount_total, 2),
        "local_campaign_count": local_campaign_total,
        "platform_sync_gap_count": sync_gap_total,
        "platform_counts": platform_counts,
        "status_counts": status_counts,
        "type_counts": type_counts,
        "runtime_boundary": "promotion_campaign_local_object_not_platform_success",
        "next_action": (
            "配置平台促销 Open API 后同步活动"
            if sync_gap_total else "继续维护活动商品与活动价"
        ),
    }


async def get_promotion_campaign(db: AsyncSession, user_id: str, campaign_id: str) -> dict | None:
    result = await db.execute(
        select(PromotionCampaign, PlatformAccount)
        .join(PlatformAccount, PlatformAccount.id == PromotionCampaign.platform_account_id)
        .where(PromotionCampaign.user_id == user_id, PromotionCampaign.id == campaign_id)
    )
    row = result.one_or_none()
    if not row:
        return None
    return await _serialize_campaign(db, row[0], row[1])


async def update_promotion_campaign(db: AsyncSession, user_id: str, campaign_id: str, data: dict[str, Any]) -> dict:
    campaign, _account = await _get_campaign_and_account(db, user_id, campaign_id)
    if not campaign:
        raise ValueError("促销活动不存在或无权访问")
    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name:
            raise ValueError("促销活动名称不能为空")
        campaign.name = name[:200]
    if "promotion_type" in data:
        campaign.promotion_type = str(data.get("promotion_type") or campaign.promotion_type)[:50]
    if "status" in data:
        campaign.status = str(data.get("status") or campaign.status)[:30]
    if "starts_at" in data:
        campaign.starts_at = _parse_datetime(data.get("starts_at"))
    if "ends_at" in data:
        campaign.ends_at = _parse_datetime(data.get("ends_at"))
    if "external_promotion_id" in data:
        campaign.external_promotion_id = _optional_str(data.get("external_promotion_id"))
    if "stack_rule" in data:
        campaign.stack_rule = _optional_str(data.get("stack_rule"))
    if "platform_data" in data and isinstance(data.get("platform_data"), dict):
        current_data = campaign.platform_data if isinstance(campaign.platform_data, dict) else {}
        campaign.platform_data = {**current_data, **data["platform_data"]}
    await db.commit()
    return await get_promotion_campaign(db, user_id, campaign_id) or {}


async def update_promotion_campaign_status(db: AsyncSession, user_id: str, campaign_id: str, status: str) -> dict:
    normalized = str(status or "").strip()
    if not normalized:
        raise ValueError("促销活动状态不能为空")
    result = await db.execute(
        select(PromotionCampaign).where(PromotionCampaign.user_id == user_id, PromotionCampaign.id == campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise ValueError("促销活动不存在或无权访问")
    campaign.status = normalized[:30]
    await db.commit()
    updated = await get_promotion_campaign(db, user_id, campaign_id)
    if not updated:
        raise ValueError("促销活动不存在或无权访问")
    return updated


async def add_promotion_campaign_items(db: AsyncSession, user_id: str, campaign_id: str, items: list[dict[str, Any]]) -> dict:
    campaign, account = await _get_campaign_and_account(db, user_id, campaign_id)
    if not campaign:
        raise ValueError("促销活动不存在或无权访问")
    await _add_items_to_campaign(db, user_id, campaign, account, items)
    await db.commit()
    return await get_promotion_campaign(db, user_id, campaign_id) or {}


async def update_promotion_campaign_items_discount(db: AsyncSession, user_id: str, campaign_id: str, discount_value: float) -> dict:
    discount = float(discount_value)
    if discount <= 0:
        raise ValueError("折扣比例必须大于 0")
    campaign, _account = await _get_campaign_and_account(db, user_id, campaign_id)
    if not campaign:
        raise ValueError("促销活动不存在或无权访问")
    result = await db.execute(
        select(PromotionCampaignItem).where(
            PromotionCampaignItem.user_id == user_id,
            PromotionCampaignItem.campaign_id == campaign_id,
        )
    )
    for item in result.scalars().all():
        item.discount_type = "percentage"
        item.discount_value = discount
        item.promotion_price = round(float(item.original_price or 0) * (100 - discount) / 100, 2) if item.original_price is not None else None
    await db.commit()
    return await get_promotion_campaign(db, user_id, campaign_id) or {}


async def sync_promotion_campaign(db: AsyncSession, user_id: str, campaign_id: str) -> dict:
    campaign, account = await _get_campaign_and_account(db, user_id, campaign_id)
    if not campaign:
        raise ValueError("促销活动不存在或无权访问")
    connector = get_platform_connector_status(account)
    operation_details = connector.get("operation_details") if isinstance(connector.get("operation_details"), list) else []
    marketing_operation = next((item for item in operation_details if item.get("id") == "marketing"), {})
    gaps = _promotion_sync_data_gaps(connector, marketing_operation)
    sync_attempt = _build_promotion_sync_attempt(account, connector, marketing_operation, gaps)

    if not gaps:
        client = PlatformClientFactory.get_client(account.platform, account, decrypt)
        if not client:
            gaps = ["promotion_open_api.client_not_registered"]
            sync_attempt["data_gaps"] = gaps
        else:
            try:
                if not await client.authenticate():
                    gaps = ["promotion_open_api.authentication_failed"]
                    sync_attempt["data_gaps"] = gaps
                    sync_attempt["boundary"] = "promotion_open_api_authentication_failed"
                else:
                    response = await client.sync_promotion_campaign(_promotion_sync_payload(account, campaign))
                    sync_attempt["platform_response"] = response
                    sync_attempt["boundary"] = "promotion_open_api_response_received"
                    official_id = _official_promotion_id(response)
                    if official_id:
                        campaign.external_promotion_id = official_id
                        campaign.source = "platform"
            except PlatformOperationUnavailable as exc:
                gaps = ["promotion_open_api.not_implemented", "platform_operation.marketing_not_implemented"]
                sync_attempt["data_gaps"] = gaps
                sync_attempt["boundary"] = "promotion_open_api_not_executed_without_marketing_operation"
                sync_attempt["platform_response"] = {"error": str(exc)}
            except Exception as exc:
                gaps = ["promotion_open_api.call_failed"]
                sync_attempt["data_gaps"] = gaps
                sync_attempt["boundary"] = "promotion_open_api_call_failed"
                sync_attempt["platform_response"] = {"error": str(exc)}

    current_data = campaign.platform_data if isinstance(campaign.platform_data, dict) else {}
    campaign.platform_data = {**current_data, "promotion_platform_sync": sync_attempt}
    await db.commit()
    serialized = await get_promotion_campaign(db, user_id, campaign_id) or {}
    status = "synced" if not gaps and serialized.get("external_promotion_id") else "configuration_required"
    return {
        "status": status,
        "campaign": serialized,
        "data_gaps": gaps,
        "evidence_window": "促销活动平台同步",
        "confidence_reason": (
            "促销同步已读取当前店铺 Open API 连接状态和 marketing 操作能力；"
            "未具备真实营销接口能力前只记录本地同步尝试，不写入平台活动 ID，不标记平台同步成功。"
        ),
    }


def _build_promotion_sync_attempt(
    account: PlatformAccount,
    connector: dict[str, Any],
    marketing_operation: dict[str, Any],
    gaps: list[str],
) -> dict[str, Any]:
    return {
        "schema": "promotion_platform_sync_attempt.v1",
        "platform": account.platform,
        "account_id": account.id,
        "connection_status": connector.get("connection_status"),
        "authorization_status": connector.get("authorization_status"),
        "marketing_operation_status": marketing_operation.get("status") or "not_implemented",
        "data_gaps": gaps,
        "attempted_at": datetime.now(timezone.utc).isoformat(),
        "boundary": "promotion_open_api_not_executed_without_marketing_operation",
    }


def _promotion_sync_data_gaps(connector: dict[str, Any], marketing_operation: dict[str, Any]) -> list[str]:
    gaps = ["promotion_open_api.not_implemented"]
    connection_status = str(connector.get("connection_status") or "")
    authorization_status = str(connector.get("authorization_status") or "")
    marketing_status = str(marketing_operation.get("status") or "not_implemented")
    if connection_status and connection_status != "unverified":
        gaps.append(f"platform_connection.{connection_status}")
    if authorization_status and authorization_status != "authorized":
        gaps.append(f"platform_authorization.{authorization_status}")
    if marketing_status != "implemented":
        gaps.append("platform_operation.marketing_not_implemented")
    if connection_status == "unverified" and authorization_status == "authorized" and marketing_status == "implemented":
        gaps = []
    return list(dict.fromkeys(gaps))


def _promotion_sync_payload(account: PlatformAccount, campaign: PromotionCampaign) -> dict[str, Any]:
    platform_data = campaign.platform_data if isinstance(campaign.platform_data, dict) else {}
    return {
        "platform": account.platform,
        "shop_id": account.shop_id,
        "campaign_id": campaign.id,
        "name": campaign.name,
        "promotion_type": campaign.promotion_type,
        "starts_at": campaign.starts_at.isoformat() if campaign.starts_at else None,
        "ends_at": campaign.ends_at.isoformat() if campaign.ends_at else None,
        "marketing_rules": platform_data.get("marketing_rules") if isinstance(platform_data.get("marketing_rules"), dict) else {},
        "marketing_watermark": platform_data.get("marketing_watermark") if isinstance(platform_data.get("marketing_watermark"), dict) else {},
    }


def _official_promotion_id(response: dict[str, Any]) -> str | None:
    for key in ("platform_promotion_id", "promotion_id", "activity_id", "discount_id"):
        value = response.get(key) if isinstance(response, dict) else None
        if value:
            return str(value)
    return None


async def _serialize_campaign(db: AsyncSession, campaign: PromotionCampaign, account: PlatformAccount) -> dict:
    result = await db.execute(
        select(PromotionCampaignItem, PlatformListing, Product)
        .join(PlatformListing, PlatformListing.id == PromotionCampaignItem.platform_listing_id)
        .join(Product, Product.id == PromotionCampaignItem.product_id)
        .where(PromotionCampaignItem.campaign_id == campaign.id)
        .order_by(PromotionCampaignItem.created_at.asc())
    )
    items = []
    for item, listing, product in result.all():
        original_price = item.original_price
        promotion_price = item.promotion_price
        discount_amount = None
        if original_price is not None and promotion_price is not None:
            discount_amount = round(max(float(original_price) - float(promotion_price), 0), 2)
        items.append({
            "id": item.id,
            "platform_listing_id": listing.id,
            "product_id": product.id,
            "product_name": product.name,
            "listing_title": listing.title,
            "sku": item.sku,
            "discount_type": item.discount_type,
            "discount_value": item.discount_value,
            "original_price": item.original_price,
            "promotion_price": item.promotion_price,
            "discount_amount": discount_amount,
            "stock_limit": item.stock_limit,
            "status": item.status,
        })
    price_summary = _campaign_price_summary(items)
    return {
        "id": campaign.id,
        "name": campaign.name,
        "promotion_type": campaign.promotion_type,
        "status": campaign.status,
        "platform": campaign.platform,
        "store": {
            "id": account.id,
            "account_name": account.account_name,
            "shop_id": account.shop_id,
            "market": (account.settings or {}).get("market") if isinstance(account.settings, dict) else None,
        },
        "starts_at": campaign.starts_at.isoformat() if campaign.starts_at else None,
        "ends_at": campaign.ends_at.isoformat() if campaign.ends_at else None,
        "external_promotion_id": campaign.external_promotion_id,
        "stack_rule": campaign.stack_rule,
        "source": campaign.source,
        "platform_data": campaign.platform_data if isinstance(campaign.platform_data, dict) else {},
        "product_count": len(items),
        "price_summary": price_summary,
        "items": items,
    }


async def _get_account(db: AsyncSession, user_id: str, account_id: str) -> PlatformAccount | None:
    result = await db.execute(select(PlatformAccount).where(PlatformAccount.user_id == user_id, PlatformAccount.id == account_id))
    return result.scalar_one_or_none()


async def _get_campaign_and_account(db: AsyncSession, user_id: str, campaign_id: str) -> tuple[PromotionCampaign | None, PlatformAccount | None]:
    result = await db.execute(
        select(PromotionCampaign, PlatformAccount)
        .join(PlatformAccount, PlatformAccount.id == PromotionCampaign.platform_account_id)
        .where(PromotionCampaign.user_id == user_id, PromotionCampaign.id == campaign_id)
    )
    row = result.one_or_none()
    if not row:
        return None, None
    return row[0], row[1]


async def _get_listing_for_account(db: AsyncSession, user_id: str, account_id: str, listing_id: str) -> PlatformListing | None:
    result = await db.execute(select(PlatformListing).where(
        PlatformListing.user_id == user_id,
        PlatformListing.platform_account_id == account_id,
        PlatformListing.id == listing_id,
    ))
    return result.scalar_one_or_none()


async def _add_items_to_campaign(
    db: AsyncSession,
    user_id: str,
    campaign: PromotionCampaign,
    account: PlatformAccount,
    items: list[dict[str, Any]],
) -> None:
    existing_result = await db.execute(
        select(PromotionCampaignItem.platform_listing_id).where(PromotionCampaignItem.campaign_id == campaign.id)
    )
    existing_listing_ids = set(existing_result.scalars().all())
    for raw_item in items:
        if not isinstance(raw_item, dict):
            continue
        listing = await _get_listing_for_account(db, user_id, account.id, str(raw_item.get("platform_listing_id") or ""))
        if not listing:
            raise ValueError("促销参与商品不存在、无权访问或不属于当前店铺")
        if listing.id in existing_listing_ids:
            continue
        discount_value = _optional_float(raw_item.get("discount_value"))
        promotion_price = _optional_float(raw_item.get("promotion_price"))
        if promotion_price is None and discount_value is not None and listing.price is not None:
            promotion_price = round(float(listing.price) * (100 - discount_value) / 100, 2)
        db.add(PromotionCampaignItem(
            user_id=user_id,
            campaign_id=campaign.id,
            platform_listing_id=listing.id,
            product_id=listing.product_id,
            sku=_optional_str(raw_item.get("sku")),
            discount_type=str(raw_item.get("discount_type") or "percentage"),
            discount_value=discount_value,
            original_price=listing.price,
            promotion_price=promotion_price,
            stock_limit=_optional_int(raw_item.get("stock_limit")),
            status=str(raw_item.get("status") or "planned"),
            platform_data=raw_item.get("platform_data") if isinstance(raw_item.get("platform_data"), dict) else {},
        ))
        existing_listing_ids.add(listing.id)


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def _optional_str(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _optional_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    return float(value)


def _optional_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    return int(value)


def _campaign_price_summary(items: list[dict[str, Any]]) -> dict[str, Any]:
    priced_items = [
        item for item in items
        if item.get("original_price") is not None and item.get("promotion_price") is not None
    ]
    original_total = round(sum(float(item["original_price"]) for item in priced_items), 2)
    promotion_total = round(sum(float(item["promotion_price"]) for item in priced_items), 2)
    discount_total = round(max(original_total - promotion_total, 0), 2)
    avg_discount_pct = round((discount_total / original_total) * 100, 2) if original_total > 0 else None
    return {
        "priced_item_count": len(priced_items),
        "original_price_total": original_total,
        "promotion_price_total": promotion_total,
        "discount_amount_total": discount_total,
        "avg_discount_pct": avg_discount_pct,
        "source": "promotion_campaign_items",
        "note": "按当前活动参与 Listing 的原价与促销价计算；平台 Open API 未接通前不代表真实成交效果。",
    }

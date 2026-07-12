"""Promotion campaign service.

Promotions are independent campaign objects. A campaign belongs to one
platform/store and contains many participating platform listings/SKUs.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.promotion import PromotionCampaign, PromotionCampaignItem


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
    campaign, _account = await _get_campaign_and_account(db, user_id, campaign_id)
    if not campaign:
        raise ValueError("促销活动不存在或无权访问")
    serialized = await get_promotion_campaign(db, user_id, campaign_id) or {}
    return {
        "status": "configuration_required",
        "campaign": serialized,
        "data_gaps": ["promotion_open_api.not_implemented"],
        "evidence_window": "促销活动平台同步",
        "confidence_reason": "当前 Shopee/TEMU/TikTok Shop 促销 Open API 尚未接通；未写入平台活动 ID，未标记平台同步成功。",
    }


async def _serialize_campaign(db: AsyncSession, campaign: PromotionCampaign, account: PlatformAccount) -> dict:
    result = await db.execute(
        select(PromotionCampaignItem, PlatformListing, Product)
        .join(PlatformListing, PlatformListing.id == PromotionCampaignItem.platform_listing_id)
        .join(Product, Product.id == PromotionCampaignItem.product_id)
        .where(PromotionCampaignItem.campaign_id == campaign.id)
        .order_by(PromotionCampaignItem.created_at.asc())
    )
    items = [
        {
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
            "stock_limit": item.stock_limit,
            "status": item.status,
        }
        for item, listing, product in result.all()
    ]
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
        "product_count": len(items),
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

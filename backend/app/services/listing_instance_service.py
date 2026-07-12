"""Listing instance matrix and store-level override helpers."""

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product


async def get_product_listing_matrix(db: AsyncSession, user_id: str, product_id: str) -> dict | None:
    product = await _get_owned_product(db, user_id, product_id)
    if not product:
        return None

    result = await db.execute(
        select(PlatformListing, PlatformAccount)
        .join(PlatformAccount, PlatformAccount.id == PlatformListing.platform_account_id)
        .where(
            PlatformListing.user_id == user_id,
            PlatformListing.product_id == product.id,
        )
        .order_by(PlatformAccount.platform, PlatformAccount.account_name, PlatformListing.updated_at.desc())
    )
    instances = [
        _serialize_listing_instance(listing, account)
        for listing, account in result.all()
    ]
    return {
        "product_master": _serialize_product_master(product),
        "base_version": _product_base_version(product),
        "listing_instances": instances,
        "rules": {
            "store_override_isolation": True,
            "master_update_requires_explicit_action": True,
            "platform_sync_updates_listing_only": True,
        },
    }


async def update_listing_overrides(
    db: AsyncSession,
    user_id: str,
    listing_id: str,
    overrides: dict[str, Any],
) -> dict | None:
    result = await db.execute(
        select(PlatformListing, PlatformAccount)
        .join(PlatformAccount, PlatformAccount.id == PlatformListing.platform_account_id)
        .where(
            PlatformListing.id == listing_id,
            PlatformListing.user_id == user_id,
        )
    )
    row = result.one_or_none()
    if not row:
        return None

    listing, account = row
    platform_data = _remove_promotion_config(deepcopy(listing.platform_data or {}))
    platform_data["listing_snapshot"] = _remove_promotion_config(
        platform_data.get("listing_snapshot") if isinstance(platform_data.get("listing_snapshot"), dict) else _snapshot_from_listing(listing)
    )
    clean_overrides = {
        key: value
        for key, value in (overrides or {}).items()
        if key != "promotion_config"
    }
    platform_data["listing_overrides"] = {
        **(platform_data.get("listing_overrides") if isinstance(platform_data.get("listing_overrides"), dict) else {}),
        **clean_overrides,
    }

    if "title" in overrides and isinstance(overrides["title"], str) and overrides["title"].strip():
        listing.title = overrides["title"].strip()[:500]
    if "description" in overrides and isinstance(overrides["description"], str):
        listing.description = overrides["description"]
    if "price" in overrides and overrides["price"] is not None:
        listing.price = float(overrides["price"])
    if "stock" in overrides and overrides["stock"] is not None:
        listing.stock = int(overrides["stock"])
    if "images" in overrides and isinstance(overrides["images"], list):
        listing.images = overrides["images"]
    if "variations" in overrides and isinstance(overrides["variations"], list):
        listing.variations = overrides["variations"]
    if "shipping_config" in overrides and isinstance(overrides["shipping_config"], dict):
        listing.shipping_config = overrides["shipping_config"]
    if "video_url" in overrides:
        platform_data["video_url"] = _safe_string(overrides.get("video_url"))
    if "source_url" in overrides:
        platform_data["source_url"] = _safe_string(overrides.get("source_url"))
    if "publish_plan" in overrides and isinstance(overrides["publish_plan"], dict):
        platform_data["publish_plan"] = _clean_mapping(overrides["publish_plan"])
        platform_data["platform_api_status"] = "not_connected"
        platform_data["platform_publish_status"] = "not_attempted"

    listing.platform_data = platform_data
    await db.commit()
    await db.refresh(listing)
    return _serialize_listing_instance(listing, account)


async def promote_listing_to_base_version(
    db: AsyncSession,
    user_id: str,
    listing_id: str,
) -> dict | None:
    """Explicitly promote one store Listing back into the product base version."""
    result = await db.execute(
        select(PlatformListing, PlatformAccount, Product)
        .join(PlatformAccount, PlatformAccount.id == PlatformListing.platform_account_id)
        .join(Product, Product.id == PlatformListing.product_id)
        .where(
            PlatformListing.id == listing_id,
            PlatformListing.user_id == user_id,
            Product.user_id == user_id,
        )
    )
    row = result.one_or_none()
    if not row:
        return None

    listing, account, product = row
    product_attributes = deepcopy(product.attributes or {})
    previous_base = product_attributes.get("base_version") if isinstance(product_attributes.get("base_version"), dict) else {}
    previous_version = _safe_int(previous_base.get("version"), default=1)
    platform_data = listing.platform_data if isinstance(listing.platform_data, dict) else {}
    listing_overrides = platform_data.get("listing_overrides") if isinstance(platform_data.get("listing_overrides"), dict) else {}
    platform_requirements = platform_data.get("platform_requirements") if isinstance(platform_data.get("platform_requirements"), dict) else {}
    requirement_values = platform_requirements.get("attribute_values") if isinstance(platform_requirements.get("attribute_values"), dict) else {}
    override_values = listing_overrides.get("platform_attributes") if isinstance(listing_overrides.get("platform_attributes"), dict) else {}
    images = listing.images if isinstance(listing.images, list) else []
    variations = listing.variations if isinstance(listing.variations, list) else []

    base_version = {
        "version": previous_version + 1,
        "title": listing.title,
        "description": listing.description or "",
        "images": images,
        "attribute_values": {**requirement_values, **override_values},
        "variations": variations,
        "source_listing_id": listing.id,
        "source_platform": account.platform,
        "source_store": {
            "id": account.id,
            "account_name": account.account_name,
            "shop_id": account.shop_id,
            "market": (account.settings or {}).get("market") if isinstance(account.settings, dict) else None,
        },
        "promoted_at": datetime.now(timezone.utc).isoformat(),
        "previous_version": previous_version,
    }
    product_attributes["base_version"] = base_version
    product.attributes = product_attributes
    product.description = listing.description or product.description
    if images:
        product.images = images

    await db.commit()
    await db.refresh(product)
    await db.refresh(listing)
    return {
        "product_master": _serialize_product_master(product),
        "base_version": _product_base_version(product),
        "listing_instance": _serialize_listing_instance(listing, account),
    }


async def _get_owned_product(db: AsyncSession, user_id: str, product_id: str) -> Product | None:
    result = await db.execute(select(Product).where(Product.id == product_id, Product.user_id == user_id))
    return result.scalar_one_or_none()


def _serialize_product_master(product: Product) -> dict:
    attributes = product.attributes if isinstance(product.attributes, dict) else {}
    return {
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "brand": product.brand,
        "category_id": product.category_id,
        "cost_price": product.cost_price,
        "weight_g": product.weight_g,
        "dimensions": product.dimensions if isinstance(product.dimensions, dict) else product.dimensions,
        "images": product.images if isinstance(product.images, list) else [],
        "source_offer_id": attributes.get("source_offer_id"),
        "selection_refs": attributes.get("selection_refs") or attributes.get("evidence_refs") or [],
    }


def _product_base_version(product: Product) -> dict:
    attributes = product.attributes if isinstance(product.attributes, dict) else {}
    base = attributes.get("base_version")
    if isinstance(base, dict):
        return base
    return {
        "version": 1,
        "title": product.name,
        "description": product.description or "",
        "images": product.images if isinstance(product.images, list) else [],
        "attributes": attributes.get("base_attributes") or {},
    }


def _serialize_listing_instance(listing: PlatformListing, account: PlatformAccount) -> dict:
    platform_data = _remove_promotion_config(listing.platform_data if isinstance(listing.platform_data, dict) else {})
    listing_overrides = platform_data.get("listing_overrides") if isinstance(platform_data.get("listing_overrides"), dict) else {}
    return {
        "id": listing.id,
        "product_id": listing.product_id,
        "platform": account.platform,
        "store": {
            "id": account.id,
            "account_name": account.account_name,
            "shop_id": account.shop_id,
            "market": (account.settings or {}).get("market") if isinstance(account.settings, dict) else None,
        },
        "platform_product_id": listing.platform_product_id,
        "title": listing.title,
        "description": listing.description,
        "price": listing.price,
        "stock": listing.stock,
        "status": listing.status,
        "images": listing.images if isinstance(listing.images, list) else [],
        "variations": listing.variations if isinstance(listing.variations, list) else [],
        "video_url": platform_data.get("video_url") or listing_overrides.get("video_url"),
        "source_url": platform_data.get("source_url") or listing_overrides.get("source_url"),
        "shipping_config": listing.shipping_config if isinstance(listing.shipping_config, dict) else listing_overrides.get("shipping_config") or {},
        "publish_plan": platform_data.get("publish_plan") if isinstance(platform_data.get("publish_plan"), dict) else listing_overrides.get("publish_plan") or {},
        "platform_requirements": platform_data.get("platform_requirements") or {},
        "listing_overrides": listing_overrides,
        "snapshot": platform_data.get("listing_snapshot") or _snapshot_from_listing(listing),
        "performance": listing.performance if isinstance(listing.performance, dict) else {},
        "platform_publish_status": platform_data.get("platform_publish_status"),
        "platform_api_status": platform_data.get("platform_api_status"),
        "updated_at": listing.updated_at.isoformat() if listing.updated_at else None,
    }


def _snapshot_from_listing(listing: PlatformListing) -> dict:
    return {
        "title": listing.title,
        "description": listing.description,
        "price": listing.price,
        "stock": listing.stock,
        "images": listing.images if isinstance(listing.images, list) else [],
        "variations": listing.variations if isinstance(listing.variations, list) else [],
        "shipping_config": listing.shipping_config if isinstance(listing.shipping_config, dict) else {},
        "platform_data": deepcopy(listing.platform_data or {}),
    }


def _safe_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:1000] if text else None


def _clean_mapping(value: dict[str, Any]) -> dict[str, Any]:
    return {
        str(key): item
        for key, item in value.items()
        if item is not None and item != ""
    }


def _remove_promotion_config(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _remove_promotion_config(item)
            for key, item in value.items()
            if key != "promotion_config"
        }
    if isinstance(value, list):
        return [_remove_promotion_config(item) for item in value]
    return value


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

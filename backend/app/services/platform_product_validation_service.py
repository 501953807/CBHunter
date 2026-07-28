"""Build dynamic platform field validation payloads for synced products."""

from typing import Any

from app.integrations.base import PlatformProduct
from app.services.listing_draft_asset_service import build_validation_checks
from app.services.platform_product_field_service import merge_platform_requirements


def build_synced_product_platform_validation(
    *,
    platform: str,
    remote_product: PlatformProduct,
    field_schemas: dict | None,
) -> dict:
    """Return merged platform requirements and validation checks for a synced listing."""
    attribute_values = _attribute_values(platform, remote_product)
    platform_requirements = merge_platform_requirements(
        {
            "category_id": remote_product.platform_category_id or remote_product.category_id,
            "attribute_values": attribute_values,
        },
        platform,
        field_schemas,
    )
    validation_checks = build_validation_checks(
        title=remote_product.title,
        selling_price=remote_product.price,
        sku_plan={
            "master_sku": _first_sku(remote_product),
            "variants": remote_product.variations or [],
        },
        media_assets={"images": remote_product.images or []},
        logistics=_logistics_values(remote_product),
        compliance=_compliance_values(remote_product),
        platform_requirements=platform_requirements,
        fee_missing=False,
        blocking_reasons=[],
    )
    return {
        "attribute_values": attribute_values,
        "platform_requirements": platform_requirements,
        "validation_checks": validation_checks,
    }


def _attribute_values(platform: str, remote_product: PlatformProduct) -> dict:
    raw = remote_product.raw_data if isinstance(remote_product.raw_data, dict) else {}
    values = {
        "platform_product_id": remote_product.platform_product_id,
        "product_title": remote_product.title,
        "product_name": remote_product.title,
        "product_description": remote_product.description,
        "description": remote_product.description,
        "category": _first_present(
            raw,
            "category",
            "category_name",
            "category_path",
            "global_category",
        ) or remote_product.platform_category_id or remote_product.category_id,
        "category_id": remote_product.platform_category_id or remote_product.category_id,
        "stock": remote_product.stock,
        "sku_stock": remote_product.stock,
        "selling_price": remote_product.price,
        "sku_price": remote_product.price,
        "retail_price": remote_product.price,
        "declared_price_cny": remote_product.price,
        "product_images": remote_product.images or [],
        "main_image": (remote_product.images or [None])[0],
        "variation_values": _variation_values(remote_product.variations),
        "sku_attributes": remote_product.variations or [],
        "sku_count": len(remote_product.variations or []),
        "seller_sku": _first_sku(remote_product),
        "sku_id": _first_sku(remote_product),
        "global_product_sku": _first_sku(remote_product),
        "model_id": _first_present(raw, "model_id", "modelId", "model_id_list"),
        "global_product_status": remote_product.status,
        "product_info_status": remote_product.status,
        "listing_status": remote_product.status,
        "review_status": _first_present(raw, "review_status", "reviewStatus", "audit_status"),
        "brand": _first_present(raw, "brand", "brand_name", "brandName") or "No Brand",
        "shop_name": _first_present(raw, "shop_name", "shopName", "store_name"),
    }
    values.update(_raw_attribute_pairs(raw))
    values.update(_platform_aliases(platform, values, raw))
    return {key: value for key, value in values.items() if _has_value(value)}


def _platform_aliases(platform: str, values: dict, raw: dict) -> dict:
    if platform == "temu":
        return {
            "spu_id": _first_present(raw, "spu_id", "spuId", "product_spu_id") or values.get("platform_product_id"),
            "skc_id": _first_present(raw, "skc_id", "skcId"),
            "material": _first_present(raw, "material", "fabric", "材质"),
            "color": _first_present(raw, "color", "colour", "颜色"),
            "price_status": _first_present(raw, "price_status", "priceStatus"),
            "published_sites": _first_present(raw, "published_sites", "publishedSites", "sites"),
        }
    if platform == "tiktok":
        return {
            "short_video_required": _first_present(raw, "short_video_required", "video_required"),
            "creator_brief": _first_present(raw, "creator_brief", "creatorBrief"),
            "product_score": _first_present(raw, "product_score", "productScore"),
            "traffic_support": _first_present(raw, "traffic_support", "trafficSupport"),
        }
    return {
        "content_diagnosis": _first_present(raw, "content_diagnosis", "diagnosis", "smart_diagnosis_status"),
        "hot_listing_status": _first_present(raw, "hot_listing_status", "hotListingStatus"),
        "voucher_status": _first_present(raw, "voucher_status", "voucherStatus"),
    }


def _raw_attribute_pairs(raw: dict) -> dict:
    pairs: dict[str, Any] = {}
    for container_key in ("attributes", "product_attributes", "sales_attributes", "sku_attributes"):
        attributes = raw.get(container_key)
        if isinstance(attributes, dict):
            pairs.update(attributes)
            continue
        if not isinstance(attributes, list):
            continue
        for item in attributes:
            if not isinstance(item, dict):
                continue
            key = _first_present(item, "key", "name", "attribute_name", "attributeName")
            value = _first_present(item, "value", "attribute_value", "attributeValue", "values")
            if key and _has_value(value):
                pairs[str(key)] = value
    return pairs


def _variation_values(variations: list | None) -> list:
    values = []
    for variant in variations or []:
        if not isinstance(variant, dict):
            continue
        label = _first_present(variant, "name", "option", "color", "size", "variation_name")
        if label:
            values.append(label)
    return values


def _first_sku(remote_product: PlatformProduct) -> str | None:
    raw = remote_product.raw_data if isinstance(remote_product.raw_data, dict) else {}
    sku = _first_present(raw, "merchant_sku", "seller_sku", "sellerSku", "sku", "item_sku", "skuExtCode")
    if sku:
        return str(sku)
    for variant in remote_product.variations or []:
        if not isinstance(variant, dict):
            continue
        sku = _first_present(variant, "sku", "seller_sku", "sellerSku", "model_sku", "skuExtCode")
        if sku:
            return str(sku)
    return None


def _logistics_values(remote_product: PlatformProduct) -> dict:
    raw = remote_product.raw_data if isinstance(remote_product.raw_data, dict) else {}
    return {
        "weight_g": _first_present(raw, "weight_g", "weight", "package_weight", "sku_weight"),
        "dimensions": _first_present(raw, "dimensions", "package_dimensions", "sku_dimensions"),
    }


def _compliance_values(remote_product: PlatformProduct) -> dict:
    raw = remote_product.raw_data if isinstance(remote_product.raw_data, dict) else {}
    status = _first_present(raw, "restricted_check_status", "compliance_status", "violation_status")
    return {"restricted_check_status": status or "pending"}


def _first_present(data: dict, *keys: str) -> Any:
    for key in keys:
        value = data.get(key)
        if _has_value(value):
            return value
    return None


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict, tuple, set)):
        return bool(value)
    return True

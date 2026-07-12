"""Normalize platform product payloads into CBHunter's PlatformProduct shape."""

from typing import Any

from app.integrations.base import PlatformProduct


def normalize_platform_product(platform: str, payload: dict[str, Any]) -> PlatformProduct:
    if platform == "shopee":
        return _normalize_shopee_product(payload)
    if platform == "tiktok":
        return _normalize_tiktok_product(payload)
    if platform == "temu":
        return _normalize_temu_product(payload)
    raise ValueError(f"Unsupported product payload platform: {platform}")


def _normalize_shopee_product(payload: dict[str, Any]) -> PlatformProduct:
    variations = []
    for model in _list(payload.get("model_list")):
        variations.append({
            "platform_model_id": _text(model.get("model_id")),
            "sku": _text(model.get("model_sku") or model.get("seller_sku")),
            "stock": _stock_from(model),
            "price": _number(_first(_list(model.get("price_info"))) or model.get("price")),
            "raw": model,
        })
    return PlatformProduct(
        platform_product_id=_required_text(payload.get("item_id") or payload.get("item_id_str"), "item_id"),
        title=_required_text(payload.get("item_name") or payload.get("name"), "item_name"),
        description=_text(payload.get("description")),
        price=_number((_first(_list(payload.get("price_info"))) or {}).get("current_price") or payload.get("price")),
        stock=_stock_from(payload),
        variations=variations,
        images=_images_from(payload.get("image"), keys=("image_url_list", "images")),
        status=_text(payload.get("item_status") or payload.get("status")) or None,
        category_id=_text(payload.get("category_id")),
        platform_category_id=_text(payload.get("category_id")),
        raw_data=payload,
    )


def _normalize_tiktok_product(payload: dict[str, Any]) -> PlatformProduct:
    skus = _list(payload.get("skus"))
    variations = []
    for sku in skus:
        variations.append({
            "platform_sku_id": _text(sku.get("id") or sku.get("sku_id")),
            "sku": _text(sku.get("seller_sku") or sku.get("external_sku_id")),
            "stock": _stock_from(sku),
            "price": _number((sku.get("price") or {}).get("sale_price") or sku.get("price")),
            "attributes": sku.get("sales_attributes") or sku.get("seller_sku_attributes") or [],
            "raw": sku,
        })
    first_sku = _first(skus) or {}
    category = _first(_list(payload.get("category_chains"))) or {}
    return PlatformProduct(
        platform_product_id=_required_text(payload.get("product_id") or payload.get("id"), "product_id"),
        title=_required_text(payload.get("title") or payload.get("product_name"), "title"),
        description=_text(payload.get("description")),
        price=_number((first_sku.get("price") or {}).get("sale_price") or payload.get("price")),
        stock=sum(item.get("stock") or 0 for item in variations) if variations else _stock_from(payload),
        variations=variations,
        images=_images_from(payload.get("main_images") or payload.get("images"), keys=("url", "uri")),
        status=_text(payload.get("status")) or None,
        category_id=_text(category.get("id") or payload.get("category_id")),
        platform_category_id=_text(category.get("id") or payload.get("category_id")),
        raw_data=payload,
    )


def _normalize_temu_product(payload: dict[str, Any]) -> PlatformProduct:
    variations = []
    for skc in _list(payload.get("productSkcList") or payload.get("skcList")):
        for sku in _list(skc.get("skuList") or skc.get("productSkuList")):
            variations.append({
                "skc_id": _text(skc.get("skcId") or skc.get("skc_id")),
                "platform_sku_id": _text(sku.get("skuId") or sku.get("sku_id")),
                "sku": _text(sku.get("skuExtCode") or sku.get("sellerSku") or sku.get("sku_code")),
                "stock": _stock_from(sku),
                "price": _number(sku.get("declaredPrice") or sku.get("price")),
                "raw": sku,
            })
    first_variation = _first(variations) or {}
    return PlatformProduct(
        platform_product_id=_required_text(payload.get("spuId") or payload.get("productId") or payload.get("goodsId"), "spuId"),
        title=_required_text(payload.get("productName") or payload.get("productNameCn") or payload.get("name"), "productName"),
        description=_text(payload.get("productDescription") or payload.get("description")),
        price=_number(first_variation.get("price") or payload.get("declaredPrice") or payload.get("price")),
        stock=sum(item.get("stock") or 0 for item in variations) if variations else _stock_from(payload),
        variations=variations,
        images=_images_from(payload.get("carouselImages") or payload.get("images"), keys=("url", "imageUrl")),
        status=_text(payload.get("productInfoStatus") or payload.get("status")) or None,
        category_id=_text(payload.get("categoryId") or payload.get("catId")),
        platform_category_id=_text(payload.get("categoryId") or payload.get("catId")),
        raw_data=payload,
    )


def _required_text(value: Any, field: str) -> str:
    text = _text(value)
    if not text:
        raise ValueError(f"Remote product is missing {field}")
    return text


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _number(value: Any) -> float | None:
    if isinstance(value, dict):
        value = value.get("current_price") or value.get("sale_price") or value.get("amount")
    if value in (None, ""):
        return None
    return float(value)


def _stock_from(payload: dict[str, Any]) -> int | None:
    for key in ("stock", "total_stock", "inventory", "quantity"):
        value = payload.get(key)
        if isinstance(value, list):
            return sum(int(item.get("quantity") or item.get("stock") or 0) for item in value if isinstance(item, dict))
        if value not in (None, "") and not isinstance(value, dict):
            return int(value)
    stock_info = payload.get("stock_info_v2") if isinstance(payload.get("stock_info_v2"), dict) else {}
    summary = stock_info.get("summary_info") if isinstance(stock_info.get("summary_info"), dict) else {}
    value = summary.get("total_available_stock")
    return int(value) if value not in (None, "") else None


def _images_from(value: Any, keys: tuple[str, ...]) -> list[str]:
    if isinstance(value, dict):
        for key in keys:
            found = value.get(key)
            if isinstance(found, list):
                return [_text(item) for item in found if _text(item)]
            if _text(found):
                return [_text(found)]
    if isinstance(value, list):
        images = []
        for item in value:
            if isinstance(item, dict):
                for key in keys:
                    if _text(item.get(key)):
                        images.append(_text(item.get(key)))
                        break
            elif _text(item):
                images.append(_text(item))
        return images
    return []


def _list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _first(value: list) -> Any:
    return value[0] if value else None

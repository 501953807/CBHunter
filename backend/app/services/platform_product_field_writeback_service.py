from datetime import datetime

from app.models.platform_account import PlatformAccount


def build_platform_product_field_writeback(account: PlatformAccount, remote_product, synced_at: datetime, attribute_values: dict) -> dict:
    raw_data = remote_product.raw_data if isinstance(getattr(remote_product, "raw_data", None), dict) else {}
    standard_fields = {
        "platform_product_id": remote_product.platform_product_id,
        "title": remote_product.title,
        "description": remote_product.description,
        "price": remote_product.price,
        "stock": remote_product.stock,
        "status": remote_product.status,
        "platform_category_id": remote_product.platform_category_id or remote_product.category_id,
        "images": len(remote_product.images or []),
        "variations": len(remote_product.variations or []),
    }
    written_fields = [key for key, value in standard_fields.items() if value not in (None, "", [])]
    attribute_fields = sorted(attribute_values.keys()) if isinstance(attribute_values, dict) else []
    required_core = ("platform_product_id", "title", "price", "stock", "platform_category_id")
    missing_core = [key for key in required_core if standard_fields.get(key) in (None, "", [])]
    return {
        "schema": "platform_product_field_writeback.v1",
        "scope": "store_listing_only",
        "platform": account.platform,
        "platform_account_id": account.id,
        "shop_id": account.shop_id,
        "synced_at": synced_at.isoformat(),
        "written_fields": written_fields,
        "written_field_count": len(written_fields),
        "attribute_fields": attribute_fields,
        "attribute_field_count": len(attribute_fields),
        "raw_field_count": len(raw_data),
        "missing_core_fields": missing_core,
        "boundary_note": "平台返回字段只回写当前店铺 Listing 实例，不修改基础商品版本。",
    }

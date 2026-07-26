from app.services.listing_store_override_service import (
    listing_store_override_summary,
    override_image_urls,
    override_logistics,
    override_platform_attributes,
    override_variants,
)


def test_listing_store_override_supports_v5_editor_payload():
    payload = {
        "schema": "listing_store_override.v1",
        "store_label": "Shopee MY 主店",
        "title": "店铺覆盖标题",
        "image_slots": [
            {"label": "主图", "imageUrl": "https://img.example/main.jpg"},
            {"label": "辅图", "imageUrl": ""},
            {"label": "SKU图", "imageUrl": "https://img.example/sku.jpg"},
        ],
        "sku_rows": [
            {
                "optionOne": "Black",
                "optionTwo": "M",
                "merchantSku": "BAG-BLACK-M",
                "platformSku": "SPU-001/SKC-002",
                "skuImageRole": "SKU图 1",
                "price": "89.90",
                "stock": "12",
                "weight": "450",
                "dimensions": "20x10x8",
                "enabled": True,
            },
            {
                "optionOne": "Gray",
                "merchantSku": "BAG-GRAY-M",
                "price": "92.90",
                "stock": "0",
                "enabled": False,
            },
        ],
        "weight": "450",
        "package_size": "20×10×8",
        "compliance": "禁限售复核通过",
        "platform_attributes": {"material": "Nylon", "brand": "No Brand"},
        "boundary": "store_override_only",
    }

    summary = listing_store_override_summary(payload)

    assert override_image_urls(payload) == [
        "https://img.example/main.jpg",
        "https://img.example/sku.jpg",
    ]
    assert summary["image_count"] == 2
    assert summary["sku_count"] == 2
    assert summary["has_logistics"] is True
    assert summary["has_compliance"] is True
    assert summary["has_platform_attributes"] is True
    assert summary["override_boundary"] == "store_override_only"
    assert override_platform_attributes(payload) == {"material": "Nylon", "brand": "No Brand"}
    assert override_logistics(payload) == {
        "weight_g": 450,
        "dimensions": {"length_cm": 20, "width_cm": 10, "height_cm": 8},
    }
    assert override_variants(payload) == [{
        "sku": "BAG-BLACK-M",
        "platform_sku": "SPU-001/SKC-002",
        "spu_skc": "SPU-001/SKC-002",
        "option_1_name": "规格一",
        "option_1_value": "Black",
        "option_2_name": "规格二",
        "option_2_value": "M",
        "sku_image_role": "SKU图 1",
        "price": 89.9,
        "stock": 12,
        "weight_g": 450,
        "dimensions": {"length_cm": 20, "width_cm": 10, "height_cm": 8},
    }]

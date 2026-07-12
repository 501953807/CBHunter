"""Regression contracts for product variants/compliance and shipment package data."""

from app.schemas.product import ProductCreate
from app.schemas.shipment import ShipmentCreate
from app.services.platform_product_field_service import merge_platform_requirements


def test_product_accepts_persisted_variants_and_compliance():
    product = ProductCreate(
        name="真实商品",
        attributes={
            "variants": [{"sku": "SKU-BLACK-L", "name": "黑色 / L", "stock": 8}],
            "compliance": {"origin_country": "CN", "material": "cotton"},
        },
    )
    assert product.attributes["variants"][0]["stock"] == 8
    assert product.attributes["compliance"]["origin_country"] == "CN"


def test_shipment_accepts_destination_and_package_evidence():
    shipment = ShipmentCreate(
        order_id="order-1",
        carrier="jtexpress",
        shipping_method="standard",
        actual_weight_g=450,
        volumetric_weight_g=600,
        destination_address={"market": "MY", "country": "马来西亚", "city": "Kuala Lumpur"},
    )
    assert shipment.destination_address["market"] == "MY"
    assert shipment.volumetric_weight_g == 600


def test_platform_requirements_adds_category_specific_field_group():
    schemas = {
        "temu": {
            "groups": [
                {
                    "id": "identity",
                    "label": "SPU 与类目",
                    "fields": [{"key": "category", "label": "类目", "required": True}],
                }
            ],
            "category_profiles": [
                {
                    "id": "wallets",
                    "label": "钱包/收纳包类目差异",
                    "match": ["钱包", "收纳包"],
                    "help": "选择钱包或收纳包类目后需要补充的平台差异字段。",
                    "fields": [
                        {"key": "closure_type", "label": "闭合类型", "required": True, "evidence_state": "needs_category_recheck"},
                        {"key": "strap_type", "label": "肩带/提手", "required": False, "evidence_state": "needs_edit_page_recheck"},
                    ],
                }
            ],
        }
    }

    merged = merge_platform_requirements(
        {"attribute_values": {"category": "女包/包包配件/收纳包"}},
        "temu",
        schemas,
    )

    assert merged["category_profile"]["id"] == "wallets"
    assert any(group["id"] == "category_profile_wallets" for group in merged["field_groups"])
    assert "closure_type" in merged["required_attributes"]
    assert merged["category_field_gaps"]["needs_category_recheck"] == ["closure_type"]
    assert merged["category_field_gaps"]["needs_edit_page_recheck"] == ["strap_type"]

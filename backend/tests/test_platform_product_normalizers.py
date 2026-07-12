"""Platform product payload normalization contracts."""

from app.integrations.product_normalizers import normalize_platform_product


def test_shopee_product_payload_normalizes_to_platform_product():
    product = normalize_platform_product("shopee", {
        "item_id": 57263257465,
        "item_name": "Canvas Tote Bag",
        "description": "Large capacity tote",
        "item_status": "NORMAL",
        "category_id": 100636,
        "price_info": [{"current_price": 89.9}],
        "stock_info_v2": {"summary_info": {"total_available_stock": 500}},
        "image": {"image_url_list": ["https://cf.shopee.sg/file/a.jpg", "https://cf.shopee.sg/file/b.jpg"]},
        "model_list": [{"model_id": 336148383457, "model_sku": "BAG-BEIGE", "stock_info_v2": {"summary_info": {"total_available_stock": 200}}}],
    })

    assert product.platform_product_id == "57263257465"
    assert product.title == "Canvas Tote Bag"
    assert product.price == 89.9
    assert product.stock == 500
    assert product.images[0].startswith("https://cf.shopee.sg/")
    assert product.variations[0]["sku"] == "BAG-BEIGE"
    assert product.platform_category_id == "100636"
    assert product.raw_data["item_id"] == 57263257465


def test_tiktok_product_payload_normalizes_skus_images_and_price():
    product = normalize_platform_product("tiktok", {
        "product_id": "1736008418205009026",
        "title": "Travel Organizer Pouch",
        "description": "Waterproof organizer",
        "status": "ACTIVATE",
        "category_chains": [{"id": "601439", "local_name": "Bags"}],
        "main_images": [{"url": "https://p16.tiktokcdn.com/img/main.jpg"}],
        "skus": [
            {
                "id": "sku-1",
                "seller_sku": "ORG-BLACK",
                "price": {"sale_price": "129.00", "currency": "PHP"},
                "inventory": [{"quantity": 12}],
                "sales_attributes": [{"name": "Color", "value_name": "Black"}],
            }
        ],
    })

    assert product.platform_product_id == "1736008418205009026"
    assert product.price == 129.0
    assert product.stock == 12
    assert product.images == ["https://p16.tiktokcdn.com/img/main.jpg"]
    assert product.variations[0]["sku"] == "ORG-BLACK"
    assert product.category_id == "601439"


def test_temu_product_payload_normalizes_spu_sku_lifecycle_shape():
    product = normalize_platform_product("temu", {
        "spuId": "4641171973",
        "productName": "Heart Coin Purse",
        "productDescription": "Small purse",
        "productInfoStatus": "ACTIVE",
        "categoryId": "wallets",
        "productSkcList": [
            {
                "skcId": "75910152523",
                "skuList": [
                    {"skuId": "13176511303", "skuExtCode": "PURSE-BROWN", "stock": 88, "declaredPrice": "14.80"}
                ],
            }
        ],
        "carouselImages": ["https://img.kwcdn.com/product/purse.jpg"],
    })

    assert product.platform_product_id == "4641171973"
    assert product.title == "Heart Coin Purse"
    assert product.price == 14.8
    assert product.stock == 88
    assert product.images == ["https://img.kwcdn.com/product/purse.jpg"]
    assert product.variations[0]["sku"] == "PURSE-BROWN"
    assert product.variations[0]["skc_id"] == "75910152523"
    assert product.platform_category_id == "wallets"

"""Curated cross-border product validation samples.

These records are inserted only when the user explicitly triggers the sample
seed endpoint. They are not page fallback data.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote


SAMPLE_PACK = "cross_border_validation_v2"
MIN_PLATFORM_IMAGES = 5
RECOMMENDED_PLATFORM_IMAGES = 9
PLATFORM_FIELD_GROUPS_PATH = Path(__file__).resolve().parents[1] / "data" / "default_platform_product_field_groups.json"
SAMPLE_CHANNELS = {
    "social_entertainment": ["TikTok Creative Center", "小红书", "Facebook Reels"],
    "trend": ["Pinterest Trends", "Google Trends"],
    "sales_platform": ["Shopee", "TEMU", "TikTok Shop"],
    "supply": ["1688"],
}
PLATFORM_ACCOUNTS = [
    {"platform": "shopee", "account_name": "Shopee 东南亚验证店铺", "shop_id": "sample-shopee-sea"},
    {"platform": "shopee", "account_name": "Shopee 东南亚验证店铺 B", "shop_id": "sample-shopee-sea-b"},
    {"platform": "tiktok", "account_name": "TikTok Shop 东南亚验证店铺", "shop_id": "sample-tiktok-sea"},
    {"platform": "temu", "account_name": "TEMU 东南亚验证店铺", "shop_id": "sample-temu-sea"},
]
LISTING_TEMPLATES = [
    {"platform": "shopee", "name": "Shopee 东南亚样本 Listing 模板", "title_template": "{{product_name}} | {{category}} | Ready Stock", "description_template": "{{product_name}}\n\n核心卖点：{{keywords}}\n适用场景：东南亚跨境测款；请按店铺类目属性复核后发布。"},
    {"platform": "tiktok", "name": "TikTok Shop 东南亚样本 Listing 模板", "title_template": "{{product_name}} - Short Video Ready", "description_template": "{{product_name}}\n短视频卖点：{{keywords}}\n包含图片/视频脚本任务，发布前需复核禁限售与素材版权。"},
    {"platform": "temu", "name": "TEMU 东南亚样本 Listing 模板", "title_template": "{{product_name}} Multi-variant Pack", "description_template": "{{product_name}}\n商品属性、包装重量、变体、材质与合规说明需完整填写后提交平台审核。"},
]
FEE_TEMPLATES = [
    ("shopee", "MY", 8.0, 2.0, 1.0), ("shopee", "PH", 8.0, 2.0, 1.0),
    ("shopee", "ID", 8.0, 2.0, 1.0), ("shopee", "SG", 8.0, 2.0, 1.0),
    ("tiktok", "TH", 6.0, 2.0, 1.5), ("tiktok", "VN", 6.0, 2.0, 1.5),
    ("temu", "SG", 10.0, 2.5, 1.0), ("temu", "MY", 10.0, 2.5, 1.0),
]
EXCHANGE_RATES = {"MYR": 0.65, "PHP": 7.9, "THB": 5.05, "IDR": 2250.0, "VND": 3500.0, "SGD": 0.19}
PLATFORM_REQUIREMENTS = {
    "shopee": {
        "required_attributes": ["category", "brand", "variation_dimensions", "variation_values", "seller_sku", "stock", "selling_price"],
        "media": ["主图", "场景图", "尺寸图", "卖点图"],
        "content": ["标题关键词", "五点卖点", "商品描述", "售后/保修信息"],
        "compliance": ["禁限售复核", "类目必填属性复核", "图片版权复核"],
    },
    "temu": {
        "required_attributes": ["category", "spu_id", "product_info_status", "material", "origin_area", "color", "skc_id", "sku_id", "sku_attributes", "declared_price_cny", "price_status", "review_status"],
        "media": ["白底主图", "多角度图", "规格图", "包装图"],
        "content": ["英文标题", "属性值", "卖点描述", "包装清单"],
        "compliance": ["商品合规/认证", "平台审核字段完整性", "供货稳定性"],
    },
    "tiktok": {
        "required_attributes": ["category", "brand", "sku_count", "seller_sku", "variation_values", "stock", "retail_price"],
        "media": ["主图", "短视频", "场景图", "达人 Brief"],
        "content": ["短视频标题", "直播/短视频卖点", "商品描述", "标签/关键词"],
        "compliance": ["内容合规", "禁限售复核", "素材版权复核"],
    },
}
SAMPLES: list[dict[str, Any]] = [
    {
        "suffix": "SEA-001", "offer_id": "1037742050290",
        "name": "毛毡包中包隔层收纳包", "cn": "跨境亚马逊毛毡内胆包龙骧饺子包包中包隔层龙骧化妆品收纳包",
        "category": "女包/包包配件/收纳包", "brand": "No Brand", "cost": 12.9, "price": 19.9, "currency": "MYR",
        "weight": 200, "dims": {"length_cm": 28, "width_cm": 18, "height_cm": 6, "package_cm": "30x20x6"},
        "platform": "shopee", "market": "MY", "stock": 10500,
        "keywords": ["bag organizer", "felt insert", "makeup pouch"], "selling_points": ["多隔层收纳", "毛毡轻量支撑", "适配通勤包", "可做多尺寸变体"],
        "material": "毛毡", "variants": ["S", "M", "L"], "image": "https://cbu01.alicdn.com/img/ibank/O1CN01pnIXqh1QTW9XzqJRx_!!2864051977-0-cib.jpg_.webp",
        "supplier": "1688货源店铺", "supplier_rating": "待采集", "moq": 1, "source_platform": "妙手 Shopee 采集箱 / 1688",
        "social": "小红书包内收纳、通勤包整理内容", "trend": "Shopee/CNSC 女包配件收纳包测款",
        "compliance_risks": ["标题含第三方品牌词，发布前需去品牌化或取得授权"], "competitor": {"name": "Felt Bag Organizer Insert", "price": 24.9, "sales": 10500, "rating": 4.6},
    },
    {
        "suffix": "SEA-002", "offer_id": "989797166776",
        "name": "大容量多口袋毛毡化妆收纳包", "cn": "新款毛毡内胆化妆包大容量多口袋暗扣收纳包外贸批发毛毡包包",
        "category": "女包/包包配件/收纳包", "brand": "No Brand", "cost": 8.79, "price": 159.0, "currency": "PHP",
        "weight": 500, "dims": {"length_cm": 26, "width_cm": 16, "height_cm": 8, "package_cm": "28x18x8"},
        "platform": "shopee", "market": "PH", "stock": 12000,
        "keywords": ["felt organizer", "cosmetic pouch", "multi pocket bag"], "selling_points": ["多口袋分类", "暗扣开合", "外贸常规款", "低客单测款"],
        "material": "毛毡", "variants": ["black", "gray", "beige"], "image": "https://cbu01.alicdn.com/img/ibank/O1CN01J1mlTP2HnMvQjGINu_!!2220765449195-0-cib.jpg_.webp",
        "supplier": "1688货源店铺", "supplier_rating": "待采集", "moq": 1, "source_platform": "妙手 Shopee 采集箱 / 1688",
        "social": "Facebook Reels 居家和包内整理", "trend": "Shopee PH bag organizer rising",
        "compliance_risks": [], "competitor": {"name": "Multi Pocket Felt Organizer", "price": 189.0, "sales": 12000, "rating": 4.5},
    },
    {
        "suffix": "SEA-003", "offer_id": "946190718929",
        "name": "吐司造型小收纳包", "cn": "可爱吐司内胆包小收纳包11寸ipad收纳包零钱包耳机套包文具收纳袋",
        "category": "家居生活/居家收纳/收纳盒、收纳包与篮子", "brand": "No Brand", "cost": 7.5, "price": 129.0, "currency": "THB",
        "weight": 120, "dims": {"length_cm": 22, "width_cm": 16, "height_cm": 3, "package_cm": "24x18x4"},
        "platform": "tiktok", "market": "TH", "stock": 1500,
        "keywords": ["toast pouch", "ipad sleeve", "stationery organizer"], "selling_points": ["可爱造型", "11寸平板/文具收纳", "轻量便携", "短视频视觉强"],
        "material": "涤纶布", "variants": ["toast", "brown", "cream"], "image": "https://cbu01.alicdn.com/img/ibank/O1CN015nmj2q1s2JoLJykNW_!!2217542565708-0-cib.jpg_.webp",
        "supplier": "1688货源店铺", "supplier_rating": "待采集", "moq": 1, "source_platform": "妙手 Shopee 采集箱 / 1688",
        "social": "TikTok 可爱文具收纳开箱", "trend": "Pinterest cute desk organizer",
        "compliance_risks": ["需确认造型和图案版权"], "competitor": {"name": "Cute Toast Storage Pouch", "price": 169.0, "sales": 1500, "rating": 4.7},
    },
    {
        "suffix": "SEA-004", "offer_id": "1023258214599",
        "name": "托特包毛毡内胆定型包", "cn": "毛毡内胆包适用托特包狗牙Saint Louis整理收纳包内袋定型内衬包",
        "category": "女包/包包配件/收纳包", "brand": "No Brand", "cost": 18.5, "price": 89000.0, "currency": "IDR",
        "weight": 10, "dims": {"length_cm": 32, "width_cm": 18, "height_cm": 8, "package_cm": "34x20x8"},
        "platform": "shopee", "market": "ID", "stock": 9000,
        "keywords": ["tote organizer", "felt liner", "bag insert"], "selling_points": ["定型支撑", "多尺寸适配", "内袋分隔", "轻量毛毡"],
        "material": "毛毡", "variants": ["small", "medium", "large"], "image": "https://cbu01.alicdn.com/img/ibank/O1CN01UiVdPK1copyK4iIax_!!2201224983648-0-cib.jpg_.webp",
        "supplier": "1688货源店铺", "supplier_rating": "待采集", "moq": 1, "source_platform": "妙手 Shopee 采集箱 / 1688",
        "social": "小红书托特包整理改造", "trend": "Shopee ID tote insert demand",
        "compliance_risks": ["标题含第三方品牌词，发布前需去品牌化或取得授权"], "competitor": {"name": "Tote Bag Felt Insert", "price": 109000.0, "sales": 9000, "rating": 4.5},
    },
    {
        "suffix": "SEA-005", "offer_id": "852618213000",
        "name": "可替换斜挎包肩带", "cn": "跨境批发适用evelyne肩带mini伊芙琳改造包带替换斜跨内胆配件",
        "category": "女包/包包配件/背带", "brand": "No Brand", "cost": 5.8, "price": 99000.0, "currency": "VND",
        "weight": 200, "dims": {"length_cm": 120, "width_cm": 4, "height_cm": 2, "package_cm": "18x12x4"},
        "platform": "tiktok", "market": "VN", "stock": 18000,
        "keywords": ["replacement bag strap", "crossbody strap", "shoulder strap"], "selling_points": ["替换肩带", "多色多规格", "改造包配件", "低价高库存"],
        "material": "织带 + 金属扣", "variants": ["black", "brown", "khaki"], "image": "https://cbu01.alicdn.com/img/ibank/O1CN01TIFPIW1CpacWhppgd_!!2211644290130-0-cib.jpg_.webp",
        "supplier": "1688货源店铺", "supplier_rating": "待采集", "moq": 1, "source_platform": "妙手 Shopee 采集箱 / 1688",
        "social": "TikTok 包包改造教程", "trend": "Shopee VN replacement strap",
        "compliance_risks": ["标题含第三方品牌/型号暗示，发布前需去品牌化"], "competitor": {"name": "Replacement Crossbody Bag Strap", "price": 129000.0, "sales": 18000, "rating": 4.4},
    },
    {
        "suffix": "SEA-006", "offer_id": "1003212271489",
        "name": "迷你包斜挎改造肩带", "cn": "厂家直销适用于龙骧mini包肩带改造longcham龙骧迷你包带斜挎配件",
        "category": "女包/包包配件/背带", "brand": "No Brand", "cost": 19.8, "price": 169.0, "currency": "THB",
        "weight": 80, "dims": {"length_cm": 115, "width_cm": 3, "height_cm": 2, "package_cm": "18x10x3"},
        "platform": "tiktok", "market": "TH", "stock": 4500,
        "keywords": ["mini bag strap", "bag conversion strap", "crossbody accessory"], "selling_points": ["迷你包改造", "斜挎使用", "多扣位", "轻量配件"],
        "material": "织带 + 合金扣", "variants": ["black", "cream", "coffee"], "image": "https://cbu01.alicdn.com/img/ibank/O1CN01Qyo5ku1Li6fhClDN2_!!2215655041332-0-cib.jpg_.webp",
        "supplier": "1688货源店铺", "supplier_rating": "待采集", "moq": 1, "source_platform": "妙手 Shopee 采集箱 / 1688",
        "social": "小红书 mini 包改造", "trend": "TikTok Shop TH bag strap accessory",
        "compliance_risks": ["标题含第三方品牌词，发布前需去品牌化或取得授权"], "competitor": {"name": "Mini Bag Conversion Strap", "price": 199.0, "sales": 4500, "rating": 4.6},
    },
    {
        "suffix": "SEA-007", "offer_id": "1044008746517",
        "name": "大容量多隔层毛毡包中包", "cn": "跨境多功能中包现货批发大容量女士包毛毡内胆包多隔层毛毡内胆包",
        "category": "女包/包包配件/收纳包", "brand": "No Brand", "cost": 17.5, "price": 29.9, "currency": "MYR",
        "weight": 180, "dims": {"length_cm": 30, "width_cm": 18, "height_cm": 7, "package_cm": "32x20x8"},
        "platform": "temu", "market": "MY", "stock": 7500,
        "keywords": ["multi compartment insert", "women bag organizer", "felt inner bag"], "selling_points": ["多功能中包", "现货批发", "多隔层", "适合女士包"],
        "material": "毛毡", "variants": ["small", "medium", "large"], "image": "https://cbu01.alicdn.com/img/ibank/O1CN010Yzflk1FERLVObLLg_!!2220816010455-0-cib.jpg_.webp",
        "supplier": "1688货源店铺", "supplier_rating": "待采集", "moq": 1, "source_platform": "妙手 Shopee 采集箱 / 1688",
        "social": "Facebook 居家/包内整理内容", "trend": "Shopee MY bag organizer",
        "compliance_risks": [], "competitor": {"name": "Multi Compartment Felt Inner Bag", "price": 34.9, "sales": 7500, "rating": 4.5},
    },
    {
        "suffix": "SEA-008", "offer_id": "977477195504",
        "name": "免打孔斜挎长包带", "cn": "适用于珑龙骧mini饺子包肩带配件骧肩带免打孔改造斜挎长包带单买",
        "category": "女包/包包配件/背带", "brand": "No Brand", "cost": 11.8, "price": 219.0, "currency": "PHP",
        "weight": 1000, "dims": {"length_cm": 120, "width_cm": 4, "height_cm": 2, "package_cm": "20x12x4"},
        "platform": "shopee", "market": "PH", "stock": 33000,
        "keywords": ["no drill bag strap", "long crossbody strap", "bag accessory"], "selling_points": ["免打孔改造", "长包带单买", "斜挎使用", "高库存测款"],
        "material": "织带 + 金属扣", "variants": ["black", "brown", "stripe"], "image": "https://cbu01.alicdn.com/img/ibank/O1CN01wtY5lZ1CpadbjkPK6_!!2211644290130-0-cib.jpg_.webp",
        "supplier": "1688货源店铺", "supplier_rating": "待采集", "moq": 1, "source_platform": "妙手 Shopee 采集箱 / 1688",
        "social": "TikTok 包带改造短视频", "trend": "Shopee PH crossbody strap",
        "compliance_risks": ["标题含第三方品牌词，发布前需去品牌化或取得授权"], "competitor": {"name": "Long Crossbody Bag Strap", "price": 279.0, "sales": 33000, "rating": 4.4},
    },
]


def product_attributes(sample: dict[str, Any]) -> dict[str, Any]:
    images = sample_images(sample)
    media_readiness = sample_media_readiness(sample)
    return {
        "sample_pack": SAMPLE_PACK,
        "target_markets": [sample["market"]],
        "target_platforms": [sample["platform"]],
        "source_channels": SAMPLE_CHANNELS,
        "material": sample["material"],
        "variants": sample["variants"],
        "selling_points": sample["selling_points"],
        "listing_inputs": {
            "title_keywords": sample["keywords"],
            "image_count": len(images),
            "min_platform_images": MIN_PLATFORM_IMAGES,
            "recommended_platform_images": RECOMMENDED_PLATFORM_IMAGES,
            "media_gaps": media_readiness["gaps"],
            "video_scene": sample["social"],
        },
        "pricing_inputs": {"target_margin_pct": 28, "suggested_price_local": sample["price"], "currency": sample["currency"]},
        "sourcing_evidence": {"source": "1688", "moq": sample["moq"], "supplier_rating": sample["supplier_rating"], "supplier": sample["supplier"]},
        "decision_inputs": {"market_signal": sample["trend"], "social_signal": sample["social"], "competitor_price": sample["competitor"]["price"], "expected_margin_pct": 28, "risk_notes": ["需按目标平台类目属性复核", "图片版权和平台禁限售需人工确认"]},
        "image_evidence": {"source_page_url": sample_source_url(sample), "image_url": sample_image(sample), "source": "妙手采集箱真实货源图"},
        "media_readiness": media_readiness,
        "platform_product_evidence": {"target_platform_search_url": target_platform_search_url(sample), "status": "需登录平台进一步采集PDP，不伪造平台商品详情"},
        "platform_attribute_template": platform_attribute_payload(sample, sample["platform"]),
        "platform_requirements": platform_requirements_payload(sample),
        "content_workbench": {"title": f"{sample['keywords'][0].title()} - {sample['selling_points'][0]}", "bullets": sample["selling_points"], "image_plan": ["主图白底", "场景图", "尺寸图", "卖点图", "包装图", "短视频封面"], "video_script": f"展示{sample['name']}在{sample['social']}场景下的前后对比和核心卖点。", "ai_assist": ["标题优化", "五点描述", "主图背景清理", "短视频脚本"]},
    }


def sourcing_extra(sku: str, sample: dict[str, Any], now: datetime) -> dict[str, Any]:
    return {
        "sample_pack": SAMPLE_PACK,
        "sku": sku,
        "workflow": ["信号捕获", "候选验证", "选品决策", "内容制作", "定价校验", "平台刊登"],
        "current_evidence": {"social": sample["social"], "trend": sample["trend"], "sales_platform": sample["competitor"], "supply": sample["supplier"]},
        "ai_assist_tasks": ["归纳卖点", "生成 Listing 标题", "图片处理建议", "短视频脚本", "价格带校验"],
        "pricing_confirmation": {"currency": sample["currency"], "target_price": sample["price"], "cost_rmb": sample["cost"], "margin_status": "待复核"},
        "listing_payload": {"platform": sample["platform"], "market": sample["market"], "keywords": sample["keywords"], "variants": sample["variants"]},
        "platform_requirements": platform_requirements_payload(sample),
        "image_evidence": {"source_page_url": sample_source_url(sample), "image_url": sample_image(sample), "source": "妙手采集箱真实货源图"},
        "media_readiness": sample_media_readiness(sample),
        "platform_product_evidence": {"target_platform_search_url": target_platform_search_url(sample), "status": "需登录平台进一步采集PDP，不伪造平台商品详情"},
        "compliance_risks": sample.get("compliance_risks", []),
        "captured_at": now.isoformat(),
    }


def sample_description(sample: dict[str, Any]) -> str:
    return f"{sample['name']}，目标市场 {sample['market']}，核心卖点：{'、'.join(sample['selling_points'])}。"


def sample_image(sample: dict[str, Any]) -> str:
    return sample["image"]


def sample_images(sample: dict[str, Any]) -> list[str]:
    images = sample.get("images")
    if isinstance(images, list):
        return [image for image in images if isinstance(image, str) and image.startswith("https://")]
    image = sample_image(sample)
    return [image] if image.startswith("https://") else []


def sample_media_readiness(sample: dict[str, Any]) -> dict[str, Any]:
    images = sample_images(sample)
    missing_count = max(MIN_PLATFORM_IMAGES - len(images), 0)
    gaps = []
    if missing_count:
        gaps = [
            "缺少平台辅图",
            "缺少尺寸/规格图",
            "缺少场景使用图",
            "缺少包装或细节图",
        ][:missing_count]
    return {
        "captured_image_count": len(images),
        "min_platform_images": MIN_PLATFORM_IMAGES,
        "recommended_platform_images": RECOMMENDED_PLATFORM_IMAGES,
        "missing_image_count": missing_count,
        "gaps": gaps,
        "source": "sample_pack_real_captured_images",
    }


def sample_source_url(sample: dict[str, Any]) -> str:
    return f"http://detail.1688.com/offer/{sample['offer_id']}.html"


def target_platform_search_url(sample: dict[str, Any]) -> str:
    keyword = quote(sample["name"])
    if sample["platform"] == "tiktok":
        return f"https://www.tiktok.com/shop/s/{keyword}"
    if sample["platform"] == "temu":
        return f"https://www.temu.com/search_result.html?search_key={keyword}"
    return f"https://shopee.com/search?keyword={keyword}"


def platform_requirements_payload(sample: dict[str, Any]) -> dict[str, Any]:
    return {
        platform: {
            **requirements,
            "attribute_values": platform_attribute_payload(sample, platform),
            "field_groups": platform_field_schema(platform).get("groups", []),
            "object_model": platform_field_schema(platform).get("object_model", []),
            "evidence_source": platform_field_schema(platform).get("evidence_source"),
        }
        for platform, requirements in PLATFORM_REQUIREMENTS.items()
    }


def platform_field_schema(platform: str) -> dict[str, Any]:
    with PLATFORM_FIELD_GROUPS_PATH.open("r", encoding="utf-8") as f:
        schemas = json.load(f)
    value = schemas.get(platform, {})
    return value if isinstance(value, dict) else {}


def platform_attribute_payload(sample: dict[str, Any], platform: str) -> dict[str, Any]:
    first_variant = sample["variants"][0] if sample.get("variants") else "default"
    sku_prefix = sample.get("suffix") or sample.get("offer_id") or platform
    base = {
        "category": sample["category"],
        "brand": sample["brand"],
        "material": sample["material"],
        "package_weight_g": sample["weight"],
        "package_size": sample["dims"]["package_cm"],
        "condition": "new",
        "variations": sample["variants"],
        "variation_dimensions": "颜色/尺寸",
        "variation_values": " / ".join(sample["variants"]),
        "seller_sku": f"{sku_prefix}-{first_variant}".upper(),
        "stock": sample.get("stock"),
        "source_offer_id": sample.get("offer_id"),
    }
    if platform == "temu":
        return {
            **base,
            "origin_country": "CN",
            "declaration_name": sample["cn"],
            "supply_price_rmb": sample["cost"],
            "spu_id": f"SPU-{sku_prefix}",
            "product_info_status": "上新已确认",
            "origin_area": "CN",
            "color": first_variant,
            "skc_id": f"SKC-{sku_prefix}-{first_variant}".upper(),
            "sku_id": f"SKU-{sku_prefix}-{first_variant}".upper(),
            "sku_attributes": ",".join(sample["variants"]),
            "declared_price_cny": sample["cost"],
            "price_status": "待平台复核",
            "review_status": "本地草稿待提交",
        }
    if platform == "tiktok":
        return {
            **base,
            "short_video_required": True,
            "creator_brief": sample.get("social", ""),
            "warranty": "seller limited warranty",
            "sku_count": len(sample["variants"]),
            "retail_price": sample.get("price") or 0,
        }
    return {
        **base,
        "ship_from": "CN",
        "warranty": "supplier limited warranty / no local warranty",
        "selling_price": sample.get("price") or 0,
    }


def sample_stage(index: int) -> str:
    if index < 2:
        return "content_required"
    if index < 5:
        return "pricing_required"
    return "price_confirmed"


def sample_content_tasks(sample: dict[str, Any], *, confirmed: bool) -> dict[str, Any]:
    tasks = {
        "listing_copy": f"{sample['keywords'][0].title()} | {sample['selling_points'][0]} | {sample['market']}",
        "selling_points": "；".join(sample["selling_points"]),
        "description": sample_description(sample),
        "image_understanding": f"主图应突出{sample['material']}、尺寸、使用场景和变体。",
        "image_edit_plan": "白底主图、场景图、尺寸图、卖点图、包装图、短视频封面。",
        "video_script": f"用 15 秒展示痛点、产品使用、卖点和行动号召：{sample['social']}。",
        "compliance_check": f"{sample['platform']} / {sample['market']} 发布前复核禁限售、类目属性和素材版权。",
    }
    if not confirmed:
        return {
            key: {"versions": [{"version": 1, "content": value, "provider": "sample_pack", "status": "draft"}], "confirmed_version": None}
            for key, value in list(tasks.items())[:3]
        }
    return {
        key: {"versions": [{"version": 1, "content": value, "provider": "sample_pack", "status": "confirmed"}], "confirmed_version": 1}
        for key, value in tasks.items()
    }


def sample_pricing_confirmation(sample: dict[str, Any], sku: str) -> dict[str, Any]:
    return {
        "sku": sku,
        "currency": sample["currency"],
        "target_price": sample["price"],
        "cost_rmb": sample["cost"],
        "target_profit_pct": 28,
        "pricing_mode": "selling_based",
        "margin_status": "已确认",
    }

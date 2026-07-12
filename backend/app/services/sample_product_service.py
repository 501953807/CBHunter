"""User-triggered realistic product sample pack for module verification."""

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.competitor_product import CompetitorProduct
from app.models.content_asset import ContentAsset
from app.models.market_research import MarketResearch
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.sourcing_item import SourcingItem
from app.models.sourcing_supplier import SourcingSupplier
from app.models.supply_product import SupplyProduct
from app.models.trend_keyword import TrendKeyword
from app.models.trending_product import TrendingProduct
from app.sample_data.product_validation_pack import (
    PLATFORM_ACCOUNTS,
    SAMPLE_CHANNELS,
    SAMPLE_PACK,
    SAMPLES,
    platform_requirements_payload,
    product_attributes,
    sample_description,
    sample_content_tasks,
    sample_image,
    sample_images,
    sample_media_readiness,
    sample_pricing_confirmation,
    sample_source_url,
    sample_stage,
    sourcing_extra,
    target_platform_search_url,
)
from app.services.sample_config_service import (
    ensure_sample_exchange_rates,
    ensure_sample_fee_templates,
    ensure_sample_listing_templates,
)


async def seed_sample_products(db: AsyncSession, user_id: str) -> dict:
    now = datetime.now(timezone.utc)
    prefix = f"CBH-{user_id[:8].upper()}"
    accounts, account_created = await _ensure_accounts(db, user_id)
    created_product_ids: list[str] = []
    skipped_product_ids: list[str] = []
    created_counts = _counter(platform_accounts=account_created)
    created_counts["listing_templates"] += await ensure_sample_listing_templates(db, user_id)
    created_counts["fee_templates"] += await ensure_sample_fee_templates(db)
    created_counts["exchange_rates"] += await ensure_sample_exchange_rates(db)

    for index, sample in enumerate(SAMPLES):
        sku = f"{prefix}-{sample['suffix']}"
        product, product_created = await _upsert_product(db, user_id, sku, sample)
        (created_product_ids if product_created else skipped_product_ids).append(product.id)
        created_counts["products"] += int(product_created)

        sourcing_item, was_created = await _ensure_sourcing_item(db, user_id, sku, sample, now, index)
        created_counts["sourcing_items"] += int(was_created)
        for table_name, created in [
            ("sourcing_suppliers", await _ensure_supplier(db, user_id, sourcing_item, sample)),
            ("supply_products", await _ensure_supply_product(db, user_id, sku, sample, now)),
            ("platform_listings", await _ensure_listing(db, user_id, product, sample, accounts)),
            ("trend_keywords", await _ensure_trend_keyword(db, user_id, sample, now, index)),
            ("trending_products", await _ensure_trending_product(db, user_id, sku, sample, now)),
            ("competitor_products", await _ensure_competitor(db, user_id, sku, sample, now)),
            ("market_research", await _ensure_market_research(db, user_id, sample, now, index)),
        ]:
            created_counts[table_name] += int(created)
        created_counts["content_assets"] += await _ensure_content_assets(db, user_id, sku, sample)

    await db.commit()
    return {
        "created_count": len(created_product_ids),
        "skipped_count": len(skipped_product_ids),
        "product_ids": created_product_ids,
        "skipped_product_ids": skipped_product_ids,
        "sample_count": len(SAMPLES),
        "sample_pack": SAMPLE_PACK,
        "created_counts": created_counts,
    }


def _counter(**overrides: int) -> dict[str, int]:
    keys = [
        "products", "platform_accounts", "platform_listings", "sourcing_items",
        "sourcing_suppliers", "supply_products", "trend_keywords", "trending_products",
        "competitor_products", "market_research", "content_assets",
        "listing_templates", "fee_templates", "exchange_rates",
    ]
    values = {key: 0 for key in keys}
    values.update(overrides)
    return values


async def _ensure_accounts(db: AsyncSession, user_id: str) -> tuple[dict[str, PlatformAccount], int]:
    accounts: dict[str, PlatformAccount] = {}
    created = 0
    for account in PLATFORM_ACCOUNTS:
        existing = await db.scalar(select(PlatformAccount).where(PlatformAccount.user_id == user_id, PlatformAccount.shop_id == account["shop_id"]))
        if existing:
            accounts[account["platform"]] = existing
            continue
        model = PlatformAccount(
            user_id=user_id,
            platform=account["platform"],
            account_name=account["account_name"],
            shop_id=account["shop_id"],
            is_active=True,
            settings={"sample_pack": SAMPLE_PACK, "credential_status": "not_connected_sample"},
            token_scopes=["listing:write", "order:read", "product:read"],
        )
        db.add(model)
        await db.flush()
        accounts[account["platform"]] = model
        created += 1
    return accounts, created


async def _upsert_product(db: AsyncSession, user_id: str, sku: str, sample: dict[str, Any]) -> tuple[Product, bool]:
    attrs = product_attributes(sample)
    existing = await db.scalar(select(Product).where(Product.user_id == user_id, Product.sku == sku))
    if existing:
        existing.name = sample["name"]
        existing.description = sample_description(sample)
        existing.brand = sample["brand"]
        existing.cost_price = sample["cost"]
        existing.weight_g = sample["weight"]
        existing.dimensions = sample["dims"]
        existing.attributes = attrs
        existing.images = sample_images(sample)
        existing.tags = ["验证样本", SAMPLE_PACK, sample["platform"], sample["market"]]
        existing.notes = _sample_note()
        return existing, False
    product = Product(
        user_id=user_id,
        sku=sku,
        name=sample["name"],
        description=sample_description(sample),
        brand=sample["brand"],
        cost_price=sample["cost"],
        weight_g=sample["weight"],
        dimensions=sample["dims"],
        attributes=attrs,
        images=sample_images(sample),
        tags=["验证样本", SAMPLE_PACK, sample["platform"], sample["market"]],
        status="draft",
        notes=_sample_note(),
    )
    db.add(product)
    await db.flush()
    return product, True


async def _ensure_sourcing_item(db: AsyncSession, user_id: str, sku: str, sample: dict[str, Any], now: datetime, index: int) -> tuple[SourcingItem, bool]:
    source_url = sample_source_url(sample)
    existing = await db.scalar(select(SourcingItem).where(SourcingItem.user_id == user_id, SourcingItem.source_url == source_url))
    if existing:
        existing.source_price_rmb = sample["cost"]
        existing.product_name = sample["name"]
        existing.product_name_cn = sample["cn"]
        existing.weight_g = sample["weight"]
        existing.category = sample["category"]
        existing.platform = sample["platform"]
        existing.market = sample["market"]
        existing.pipeline_stage = sample_stage(index)
        existing.selling_price_local = sample["price"]
        existing.monthly_sales = sample["competitor"]["sales"]
        existing.profit_margin_pct = 28 + index
        existing.source_image = sample_image(sample)
        existing.extra_data = _sample_extra(sku, sample, now, index)
        return existing, False
    item = SourcingItem(
        user_id=user_id,
        source_name="1688",
        source_url=source_url,
        source_price_rmb=sample["cost"],
        product_name=sample["name"],
        product_name_cn=sample["cn"],
        weight_g=sample["weight"],
        category=sample["category"],
        platform=sample["platform"],
        market=sample["market"],
        pipeline_stage=sample_stage(index),
        selling_price_local=sample["price"],
        monthly_sales=sample["competitor"]["sales"],
        profit_margin_pct=28 + index,
        domestic_shipping_rmb=3.2,
        intl_shipping_rmb=8.5,
        packaging_cost_rmb=1.2,
        platform_fee_pct=6.0,
        payment_fee_pct=2.0,
        return_reserve_pct=3.0,
        exchange_rate=1.55,
        total_cost_rmb=round(sample["cost"] + 12.9, 2),
        source_image=sample_image(sample),
        extra_data=_sample_extra(sku, sample, now, index),
        tags=["验证样本", SAMPLE_PACK, sample["category"]],
        notes="样本候选：用于验证四层信号到候选、决策、内容、定价、刊登链路。",
    )
    db.add(item)
    await db.flush()
    return item, True


async def _ensure_supplier(db: AsyncSession, user_id: str, item: SourcingItem, sample: dict[str, Any]) -> bool:
    existing = await db.scalar(select(SourcingSupplier).where(SourcingSupplier.user_id == user_id, SourcingSupplier.sourcing_item_id == item.id))
    if existing:
        existing.product_image = sample_image(sample)
        existing.purchase_price_rmb = sample["cost"]
        existing.moq = sample["moq"]
        existing.rating = sample["supplier_rating"]
        return False
    db.add(SourcingSupplier(
        user_id=user_id, sourcing_item_id=item.id, supplier_name=sample["supplier"], supplier_url=item.source_url,
        product_image=sample_image(sample), purchase_price_rmb=sample["cost"], shipping_estimate_rmb=3.2,
        moq=sample["moq"], notes="验证样本供应商，用于供应交叉验证和候选商品证据完整度检查。",
        rating=sample["supplier_rating"], is_preferred=True, quality_score=82, delivery_score=78,
        price_score=84, communication_score=80, certification_score=72, overall_score=79.2,
    ))
    return True


async def _ensure_supply_product(db: AsyncSession, user_id: str, sku: str, sample: dict[str, Any], now: datetime) -> bool:
    existing = await db.scalar(select(SupplyProduct).where(SupplyProduct.user_id == user_id, SupplyProduct.sku == sku))
    if existing:
        existing.images = sample_images(sample)
        existing.snapshot_data = {"material": sample["material"], "variants": sample["variants"], "captured_at": now.isoformat()}
        existing.price_min = sample["cost"]
        existing.price_max = round(sample["cost"] * 1.12, 2)
        return False
    db.add(SupplyProduct(
        user_id=user_id, platform="ali1688", platform_product_id=sample["offer_id"],
        name=sample["cn"], sku=sku, category_path=sample["category"], price_min=sample["cost"],
        price_max=round(sample["cost"] * 1.12, 2), price_range_text=f"¥{sample['cost']}-¥{round(sample['cost'] * 1.12, 2)}",
        shop_name=sample["supplier"], shop_url=sample_source_url(sample),
        supplier_rating=sample["supplier_rating"], sales_volume=sample["competitor"]["sales"], moq=sample["moq"],
        rating=4.7, images=sample_images(sample), product_url=sample_source_url(sample),
        tags=["验证样本", SAMPLE_PACK], source="sample_pack",
        snapshot_data={"material": sample["material"], "variants": sample["variants"], "captured_at": now.isoformat()},
        notes="1688 供货验证样本。", added_to_discovery=True,
    ))
    return True


async def _ensure_listing(db: AsyncSession, user_id: str, product: Product, sample: dict[str, Any], accounts: dict[str, PlatformAccount]) -> bool:
    account = accounts[sample["platform"]]
    existing = await db.scalar(select(PlatformListing).where(
        PlatformListing.user_id == user_id,
        PlatformListing.product_id == product.id,
        PlatformListing.platform_account_id == account.id,
    ))
    if existing:
        existing.title = f"{sample['keywords'][0].title()} | {sample['selling_points'][0]}"
        existing.description = sample_description(sample)
        existing.images = sample_images(sample)
        existing.platform_data = {
            **(existing.platform_data or {}),
            "sample_pack": SAMPLE_PACK,
            "attribute_template": product.attributes["platform_attribute_template"],
            "platform_requirements": platform_requirements_payload(sample)[sample["platform"]],
            "media_readiness": sample_media_readiness(sample),
        }
        return False
    db.add(PlatformListing(
        user_id=user_id, product_id=product.id, platform_account_id=account.id,
        platform_product_id=f"sample-listing-{sample['suffix']}", platform_category_id=f"sample-{sample['category']}",
        title=f"{sample['keywords'][0].title()} | {sample['selling_points'][0]}", description=sample_description(sample),
        price=sample["price"], compare_at_price=round(sample["price"] * 1.18, 2), stock=60,
        variations=[{"name": variant, "stock": 20, "sku": f"{product.sku}-{variant.upper()}"} for variant in sample["variants"][:3]],
        images=sample_images(sample), shipping_config={"weight_g": sample["weight"], "package": sample["dims"], "market": sample["market"]},
        status="draft", platform_data={
            "sample_pack": SAMPLE_PACK,
            "attribute_template": product.attributes["platform_attribute_template"],
            "platform_requirements": platform_requirements_payload(sample)[sample["platform"]],
            "media_readiness": sample_media_readiness(sample),
        },
        performance={"views": 0, "orders": 0, "gmv": 0},
    ))
    return True


async def _ensure_trend_keyword(db: AsyncSession, user_id: str, sample: dict[str, Any], now: datetime, index: int) -> bool:
    keyword = sample["keywords"][0]
    existing = await db.scalar(select(TrendKeyword).where(TrendKeyword.user_id == user_id, TrendKeyword.keyword == keyword, TrendKeyword.market == sample["market"]))
    if existing:
        return False
    db.add(TrendKeyword(
        user_id=user_id, keyword=keyword, market=sample["market"], category=sample["category"], search_volume=2800 + index * 320,
        trend_direction="rising", growth_pct=18 + index, competition_level=["low", "medium", "medium", "high"][index % 4],
        trend_data=_series(now, 48 + index * 3, 4), related_top=sample["keywords"], related_rising=sample["selling_points"],
        source="sample_pack", pinterest_volume=900 + index * 90, pinterest_direction="rising", pinterest_growth=12 + index,
        pinterest_trend_data=_series(now, 40 + index * 2, 3), has_pinterest_data=True, cross_validation_score=72 + index,
        cross_validation_detail={"sources": SAMPLE_CHANNELS, "sample_pack": SAMPLE_PACK}, cross_validated_at=now, last_fetched_at=now,
    ))
    return True


async def _ensure_trending_product(db: AsyncSession, user_id: str, sku: str, sample: dict[str, Any], now: datetime) -> bool:
    pid = f"sample-trending-{sample['suffix']}"
    existing = await db.scalar(select(TrendingProduct).where(TrendingProduct.user_id == user_id, TrendingProduct.platform_product_id == pid))
    if existing:
        return False
    db.add(TrendingProduct(
        user_id=user_id, platform=sample["platform"], platform_product_id=pid, name=sample["name"],
        price_min=round(sample["price"] * 0.9, 2), price_max=round(sample["price"] * 1.2, 2), price_cny=round(sample["cost"] * 1.8, 2),
        sales_volume=sample["competitor"]["sales"], sales_growth_rate=22.0, category_path=sample["category"], market=sample["market"],
        images=sample_images(sample), sku=sku, product_url=target_platform_search_url(sample),
        shop_name=f"{sample['platform']} 待授权采集", rating=sample["competitor"]["rating"], tags=["验证样本", SAMPLE_PACK],
        snapshot_data={"signal": sample["trend"], "source_channels": SAMPLE_CHANNELS}, discovered_at=now, last_updated=now,
    ))
    return True


async def _ensure_competitor(db: AsyncSession, user_id: str, sku: str, sample: dict[str, Any], now: datetime) -> bool:
    pid = f"sample-competitor-{sample['suffix']}"
    existing = await db.scalar(select(CompetitorProduct).where(CompetitorProduct.user_id == user_id, CompetitorProduct.platform_product_id == pid))
    if existing:
        return False
    db.add(CompetitorProduct(
        user_id=user_id, platform=sample["platform"], platform_product_id=pid, name=sample["competitor"]["name"],
        seller_name=f"{sample['platform']} competitor store", price=sample["competitor"]["price"], currency=sample["currency"], market=sample["market"],
        collection_method="sample_pack", confidence_level="medium", sales_estimate=sample["competitor"]["sales"], rating=sample["competitor"]["rating"],
        review_count=120 + len(sku), url=target_platform_search_url(sample), notes="竞品验证样本：用于定价校验、风险判断和选品决策页面展示；平台PDP需登录后补采，不伪造详情。",
        is_tracked=True, price_history=[{"date": (now - timedelta(days=7 * step)).date().isoformat(), "price": round(sample["competitor"]["price"] * (1 - step * 0.015), 2)} for step in range(4)],
        last_updated=now,
    ))
    return True


async def _ensure_market_research(db: AsyncSession, user_id: str, sample: dict[str, Any], now: datetime, index: int) -> bool:
    keyword = sample["keywords"][0]
    existing = await db.scalar(select(MarketResearch).where(MarketResearch.user_id == user_id, MarketResearch.keyword == keyword, MarketResearch.platform == sample["platform"]))
    if existing:
        return False
    db.add(MarketResearch(
        user_id=user_id, keyword=keyword, platform=sample["platform"], search_volume=2800 + index * 320,
        competition_level=["low", "medium", "medium", "high"][index % 4], avg_price=sample["competitor"]["price"],
        total_results=1200 + index * 130, related_keywords=sample["keywords"], trend_data=_series(now, 50 + index, 3), analyzed_at=now,
    ))
    return True


async def _ensure_content_assets(db: AsyncSession, user_id: str, sku: str, sample: dict[str, Any]) -> int:
    created = 0
    for asset_type, suffix, mime_type, size in [("image", "main", "image/jpeg", 380000), ("video", "script", "text/markdown", 1200)]:
        stored_name = f"{SAMPLE_PACK}-{sku}-{suffix}"
        existing = await db.scalar(select(ContentAsset).where(ContentAsset.user_id == user_id, ContentAsset.stored_name == stored_name))
        if existing:
            continue
        db.add(ContentAsset(
            user_id=user_id, asset_type=asset_type, original_name=f"{sample['name']}-{suffix}", stored_name=stored_name,
            mime_type=mime_type, size_bytes=size, width=1200 if asset_type == "image" else None, height=1200 if asset_type == "image" else None,
            duration_seconds=18.0 if asset_type == "video" else None, operation="sample_pack", status="ready",
            extra={"sample_pack": SAMPLE_PACK, "sku": sku, "ai_tasks": ["背景清理", "卖点图", "短视频脚本"], "source_image": sample_image(sample)},
        ))
        created += 1
    return created


def _series(now: datetime, base: int, step_size: int) -> list[dict[str, Any]]:
    return [{"date": (now - timedelta(days=7 * step)).date().isoformat(), "value": base + step * step_size} for step in range(6)]


def _sample_extra(sku: str, sample: dict[str, Any], now: datetime, index: int) -> dict[str, Any]:
    extra = sourcing_extra(sku, sample, now)
    confirmed = index >= 2
    extra["content_tasks"] = sample_content_tasks(sample, confirmed=confirmed)
    if sample_stage(index) == "price_confirmed":
        extra["pricing_confirmation"] = sample_pricing_confirmation(sample, sku)
    return extra


def _sample_note() -> str:
    return "真实业务验证样本：用于观察商品、选品、内容、定价、刊登和数据链路，不作为空页面回退数据。"

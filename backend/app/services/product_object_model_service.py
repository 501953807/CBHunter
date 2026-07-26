"""Services for the V5 product object model.

The service keeps the legacy Product / PlatformListing tables usable while
persisting explicit base-version, SKU, and platform-field-validation records.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.product_object_model import (
    PlatformFieldValidation,
    ProductBaseVersion,
    ProductSkuVariant,
)


async def create_product_base_version(
    db: AsyncSession,
    user_id: str,
    product: Product,
    *,
    version_name: str = "基础版本",
    source: str = "manual",
    change_reason: str | None = None,
) -> ProductBaseVersion:
    version_no = await _next_version_no(db, user_id, product.id)
    version = ProductBaseVersion(
        user_id=user_id,
        product_id=product.id,
        version_no=version_no,
        version_name=version_name,
        source=source,
        title=product.name,
        description=product.description,
        category_id=product.category_id,
        brand=product.brand,
        attributes=product.attributes or {},
        images=product.images or [],
        package={
            "weight_g": product.weight_g,
            "dimensions": product.dimensions or {},
        },
        content={
            "tags": product.tags or [],
            "notes": product.notes,
        },
        change_reason=change_reason,
    )
    db.add(version)
    await db.flush()
    return version


async def ensure_product_base_version(
    db: AsyncSession,
    user_id: str,
    product: Product,
    *,
    source: str = "system",
) -> ProductBaseVersion:
    existing = await db.scalar(
        select(ProductBaseVersion)
        .where(ProductBaseVersion.user_id == user_id, ProductBaseVersion.product_id == product.id)
        .order_by(ProductBaseVersion.version_no.desc())
        .limit(1)
    )
    if existing:
        return existing
    return await create_product_base_version(db, user_id, product, source=source, change_reason="V5对象模型初始化")


async def upsert_product_sku_variants(
    db: AsyncSession,
    *,
    user_id: str,
    product_id: str,
    rows: list[dict[str, Any]],
    base_version_id: str | None = None,
    platform_listing_id: str | None = None,
    scope: str = "base",
) -> list[ProductSkuVariant]:
    await _delete_existing_skus(db, user_id, product_id, base_version_id, platform_listing_id, scope)
    variants: list[ProductSkuVariant] = []
    for row in rows:
        if row.get("enabled") is False:
            continue
        variant = ProductSkuVariant(
            user_id=user_id,
            product_id=product_id,
            base_version_id=base_version_id,
            platform_listing_id=platform_listing_id,
            scope=scope,
            merchant_sku=str(row.get("merchant_sku") or row.get("sku") or row.get("platform_sku") or "").strip(),
            platform_sku=_text(row.get("platform_sku")),
            spu=_text(row.get("spu") or row.get("spu_skc")),
            skc=_text(row.get("skc") or row.get("spu_skc")),
            option_1_name=_text(row.get("option_1_name") or row.get("optionOneName") or "规格一"),
            option_1_value=_text(row.get("option_1_value") or row.get("optionOne") or row.get("option1")),
            option_2_name=_text(row.get("option_2_name") or row.get("optionTwoName") or "规格二"),
            option_2_value=_text(row.get("option_2_value") or row.get("optionTwo") or row.get("option2")),
            sku_image_url=_text(row.get("sku_image_url") or row.get("skuImageUrl")),
            price=_number(row.get("price")),
            stock=int(_number(row.get("stock")) or 0),
            weight_g=_number(row.get("weight_g") or row.get("weight")),
            dimensions=row.get("dimensions") or {},
            attributes=row.get("attributes") or {},
            enabled=True,
        )
        if not variant.merchant_sku:
            variant.merchant_sku = f"{product_id}-{len(variants) + 1}"
        variants.append(variant)
        db.add(variant)
    await db.flush()
    return variants


async def record_platform_field_validations(
    db: AsyncSession,
    *,
    user_id: str,
    product_id: str,
    platform: str,
    market: str | None,
    fields: list[dict[str, Any]],
    platform_listing_id: str | None = None,
    platform_account_id: str | None = None,
    category_id: str | None = None,
    source: str = "dictionary",
) -> list[PlatformFieldValidation]:
    await _delete_existing_field_validations(db, user_id, product_id, platform_listing_id, platform, market)
    validations: list[PlatformFieldValidation] = []
    for field in fields:
        validation = PlatformFieldValidation(
            user_id=user_id,
            product_id=product_id,
            platform_listing_id=platform_listing_id,
            platform=platform,
            market=market,
            platform_account_id=platform_account_id,
            category_id=category_id,
            field_key=str(field.get("field_key") or field.get("key") or "").strip(),
            platform_field_name=_text(field.get("platform_field_name") or field.get("label")),
            data_type=_text(field.get("data_type")) or "string",
            requirement_level=_text(field.get("requirement_level") or field.get("required")) or "optional",
            state=_text(field.get("state")) or "missing",
            current_value=field.get("current_value"),
            issue_code=_text(field.get("issue_code")),
            message=_text(field.get("message")),
            source=source,
            evidence=field.get("evidence") or {},
        )
        if not validation.field_key:
            continue
        validations.append(validation)
        db.add(validation)
    await db.flush()
    return validations


async def record_listing_platform_field_validations(
    db: AsyncSession,
    *,
    user_id: str,
    product_id: str,
    platform_listing_id: str,
    platform_account_id: str,
    platform: str,
    market: str | None,
    platform_requirements: dict[str, Any],
) -> list[PlatformFieldValidation]:
    attribute_values = platform_requirements.get("attribute_values") if isinstance(platform_requirements.get("attribute_values"), dict) else {}
    field_meta = _platform_field_meta(platform_requirements)
    required_keys = set(str(key) for key in platform_requirements.get("required_attributes") or [] if key)
    required_keys.update(key for key, meta in field_meta.items() if meta.get("required"))
    field_keys = sorted(set(field_meta) | required_keys | set(attribute_values))
    fields: list[dict[str, Any]] = []
    for key in field_keys:
        meta = field_meta.get(key) or {}
        value = attribute_values.get(key)
        evidence_state = str(meta.get("evidence_state") or "")
        is_required = key in required_keys
        state = "present" if value not in (None, "") else "missing"
        if state == "missing" and evidence_state.startswith("needs_"):
            state = "needs_recheck"
        fields.append({
            "field_key": key,
            "platform_field_name": meta.get("platform_field_name") or meta.get("label") or key,
            "data_type": meta.get("data_type") or "string",
            "requirement_level": "required" if is_required else "optional",
            "state": state,
            "current_value": value,
            "issue_code": "required_missing" if is_required and state == "missing" else evidence_state or None,
            "message": meta.get("description") or meta.get("label") or key,
            "evidence": {
                "unified_field_key": meta.get("unified_field_key"),
                "platform_field_name": meta.get("platform_field_name"),
                "country_difference": meta.get("country_difference"),
                "evidence_state": evidence_state,
            },
        })
    return await record_platform_field_validations(
        db,
        user_id=user_id,
        product_id=product_id,
        platform_listing_id=platform_listing_id,
        platform_account_id=platform_account_id,
        platform=platform,
        market=market,
        category_id=platform_requirements.get("category_id"),
        fields=fields,
        source="platform_requirements",
    )


async def persist_listing_object_model(
    db: AsyncSession,
    *,
    user_id: str,
    product: Product,
    listing: PlatformListing,
    platform: str,
    market: str | None,
    sku_plan: dict[str, Any],
    platform_requirements: dict[str, Any],
) -> dict[str, int | str]:
    base_version = await ensure_product_base_version(db, user_id, product, source="batch_publish")
    variants = sku_plan.get("variants") if isinstance(sku_plan.get("variants"), list) else []
    if not variants and sku_plan.get("master_sku"):
        variants = [{
            "merchant_sku": sku_plan.get("master_sku"),
            "price": listing.price,
            "stock": listing.stock,
        }]
    sku_rows = await upsert_product_sku_variants(
        db,
        user_id=user_id,
        product_id=product.id,
        platform_listing_id=listing.id,
        scope="listing_override",
        rows=variants,
    )
    validations = await record_listing_platform_field_validations(
        db,
        user_id=user_id,
        product_id=product.id,
        platform_listing_id=listing.id,
        platform_account_id=listing.platform_account_id,
        platform=platform,
        market=market,
        platform_requirements=platform_requirements,
    )
    return {
        "base_version_id": base_version.id,
        "sku_variant_count": len(sku_rows),
        "field_validation_count": len(validations),
    }


async def product_object_snapshot(db: AsyncSession, user_id: str, product_id: str) -> dict[str, Any]:
    product = await db.get(Product, product_id)
    if not product or product.user_id != user_id:
        return {"status": "missing", "product_id": product_id}
    versions = (await db.execute(
        select(ProductBaseVersion)
        .where(ProductBaseVersion.user_id == user_id, ProductBaseVersion.product_id == product_id)
        .order_by(ProductBaseVersion.version_no.desc())
    )).scalars().all()
    listings = (await db.execute(
        select(PlatformListing)
        .where(PlatformListing.user_id == user_id, PlatformListing.product_id == product_id)
        .order_by(PlatformListing.updated_at.desc())
    )).scalars().all()
    account_ids = [item.platform_account_id for item in listings if item.platform_account_id]
    account_rows = []
    if account_ids:
        account_rows = (await db.execute(
            select(PlatformAccount).where(PlatformAccount.id.in_(account_ids), PlatformAccount.user_id == user_id)
        )).scalars().all()
    accounts = {item.id: item for item in account_rows}
    skus = (await db.execute(
        select(ProductSkuVariant)
        .where(ProductSkuVariant.user_id == user_id, ProductSkuVariant.product_id == product_id)
        .order_by(ProductSkuVariant.scope, ProductSkuVariant.merchant_sku)
    )).scalars().all()
    validations = (await db.execute(
        select(PlatformFieldValidation)
        .where(PlatformFieldValidation.user_id == user_id, PlatformFieldValidation.product_id == product_id)
        .order_by(PlatformFieldValidation.platform, PlatformFieldValidation.field_key)
    )).scalars().all()
    missing_required = [item.field_key for item in validations if item.requirement_level == "required" and item.state != "present"]
    data_gaps = []
    if not versions:
        data_gaps.append("缺少基础商品版本")
    if not listings:
        data_gaps.append("尚未形成店铺 Listing 实例")
    if not skus:
        data_gaps.append("缺少 SKU/变体结构")
    if missing_required:
        data_gaps.append("存在平台必填字段未完成")
    return {
        "status": "ready",
        "product": {"id": product.id, "sku": product.sku, "name": product.name},
        "summary": {
            "base_version_count": len(versions),
            "listing_instance_count": len(listings),
            "sku_variant_count": len(skus),
            "field_validation_count": len(validations),
            "missing_required_field_count": len(missing_required),
        },
        "base_versions": [{"id": item.id, "version_no": item.version_no, "title": item.title, "status": item.status} for item in versions],
        "listing_instances": [{
            "id": item.id,
            "platform_account_id": item.platform_account_id,
            "platform": accounts.get(item.platform_account_id).platform if accounts.get(item.platform_account_id) else None,
            "store_name": accounts.get(item.platform_account_id).account_name if accounts.get(item.platform_account_id) else None,
            "market": (accounts.get(item.platform_account_id).settings or {}).get("market") if accounts.get(item.platform_account_id) else None,
            "platform_product_id": item.platform_product_id,
            "title": item.title,
            "status": item.status,
            "price": item.price,
            "stock": item.stock,
        } for item in listings],
        "sku_variants": [{
            "scope": item.scope,
            "platform_listing_id": item.platform_listing_id,
            "merchant_sku": item.merchant_sku,
            "platform_sku": item.platform_sku,
            "option_1_value": item.option_1_value,
            "option_2_value": item.option_2_value,
            "price": item.price,
            "stock": item.stock,
        } for item in skus],
        "field_validations": [{
            "platform": item.platform,
            "market": item.market,
            "field_key": item.field_key,
            "requirement_level": item.requirement_level,
            "state": item.state,
            "issue_code": item.issue_code,
        } for item in validations],
        "rules": {
            "base_version_is_independent": True,
            "listing_override_does_not_mutate_base": True,
            "platform_store_listing_is_separate_instance": True,
        },
        "data_gaps": data_gaps,
    }


async def _next_version_no(db: AsyncSession, user_id: str, product_id: str) -> int:
    current = await db.scalar(
        select(func.max(ProductBaseVersion.version_no))
        .where(ProductBaseVersion.user_id == user_id, ProductBaseVersion.product_id == product_id)
    )
    return int(current or 0) + 1


async def _delete_existing_skus(
    db: AsyncSession,
    user_id: str,
    product_id: str,
    base_version_id: str | None,
    platform_listing_id: str | None,
    scope: str,
) -> None:
    existing = (await db.execute(
        select(ProductSkuVariant).where(
            ProductSkuVariant.user_id == user_id,
            ProductSkuVariant.product_id == product_id,
            ProductSkuVariant.scope == scope,
            ProductSkuVariant.base_version_id.is_(None) if base_version_id is None else ProductSkuVariant.base_version_id == base_version_id,
            ProductSkuVariant.platform_listing_id.is_(None) if platform_listing_id is None else ProductSkuVariant.platform_listing_id == platform_listing_id,
        )
    )).scalars().all()
    for item in existing:
        await db.delete(item)


async def _delete_existing_field_validations(
    db: AsyncSession,
    user_id: str,
    product_id: str,
    platform_listing_id: str | None,
    platform: str,
    market: str | None,
) -> None:
    existing = (await db.execute(
        select(PlatformFieldValidation).where(
            PlatformFieldValidation.user_id == user_id,
            PlatformFieldValidation.product_id == product_id,
            PlatformFieldValidation.platform == platform,
            PlatformFieldValidation.market.is_(None) if market is None else PlatformFieldValidation.market == market,
            PlatformFieldValidation.platform_listing_id.is_(None) if platform_listing_id is None else PlatformFieldValidation.platform_listing_id == platform_listing_id,
        )
    )).scalars().all()
    for item in existing:
        await db.delete(item)


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _platform_field_meta(platform_requirements: dict[str, Any]) -> dict[str, dict[str, Any]]:
    field_meta: dict[str, dict[str, Any]] = {}
    for group in platform_requirements.get("field_groups") or []:
        if not isinstance(group, dict):
            continue
        for field in group.get("fields") or []:
            if isinstance(field, dict) and field.get("key"):
                field_meta[str(field["key"])] = field
    return field_meta

"""V5 SKU context helpers for finance traceback."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance_ledger import FinanceLedgerEntry
from app.models.product_object_model import ProductSkuVariant


async def finance_v5_sku_contexts_by_product(
    db: AsyncSession,
    user_id: str,
    entries: list[FinanceLedgerEntry],
) -> dict[str, list[dict]]:
    """Build read-only V5 SKU context for finance product traceback rows."""
    keyed_entries = [
        entry for entry in entries
        if _product_key(entry) and (entry.extra or {}).get("platform_listing_id")
    ]
    listing_ids = list({(entry.extra or {}).get("platform_listing_id") for entry in keyed_entries})
    if not listing_ids:
        return {}
    result = await db.execute(
        select(ProductSkuVariant).where(
            ProductSkuVariant.user_id == user_id,
            ProductSkuVariant.scope == "listing_override",
            ProductSkuVariant.platform_listing_id.in_(listing_ids),
            ProductSkuVariant.enabled.is_(True),
        )
    )
    variants_by_listing: dict[str, list[ProductSkuVariant]] = {}
    for variant in result.scalars().all():
        if variant.platform_listing_id:
            variants_by_listing.setdefault(variant.platform_listing_id, []).append(variant)

    contexts_by_product: dict[str, list[dict]] = {}
    seen: set[tuple[str, str, str]] = set()
    for entry in keyed_entries:
        extra = entry.extra or {}
        product_key = _product_key(entry)
        listing_id = extra.get("platform_listing_id")
        sku = extra.get("sku") or extra.get("merchant_sku") or extra.get("platform_sku")
        variants = variants_by_listing.get(listing_id, [])
        matched = _match_finance_sku_variant(sku, variants)
        seen_key = (product_key, listing_id, sku or "")
        if seen_key in seen:
            continue
        seen.add(seen_key)
        if matched:
            contexts_by_product.setdefault(product_key, []).append({
                "status": "matched",
                "source": "v5_product_sku_variants",
                "platform_listing_id": listing_id,
                "sku_variant_id": matched.id,
                "ledger_sku": sku,
                "merchant_sku": matched.merchant_sku,
                "platform_sku": matched.platform_sku,
                "spu": matched.spu,
                "skc": matched.skc,
                "option_1": _option_value(matched.option_1_name, matched.option_1_value),
                "option_2": _option_value(matched.option_2_name, matched.option_2_value),
                "listing_stock": matched.stock,
                "listing_price": matched.price,
                "source_entry_id": entry.id,
            })
        elif variants:
            contexts_by_product.setdefault(product_key, []).append({
                "status": "unmatched",
                "source": "v5_product_sku_variants",
                "platform_listing_id": listing_id,
                "ledger_sku": sku,
                "available_sku_count": len(variants),
                "source_entry_id": entry.id,
                "data_gaps": ["财务台账 SKU 未匹配到当前店铺 Listing 的 V5 SKU 结构"],
            })
    return contexts_by_product


def _product_key(entry: FinanceLedgerEntry) -> str:
    return entry.sourcing_item_id or (entry.extra or {}).get("product_id") or ""


def _match_finance_sku_variant(
    sku: str | None,
    variants: list[ProductSkuVariant],
) -> ProductSkuVariant | None:
    if not sku:
        return None
    normalized = sku.strip().lower()
    for variant in variants:
        candidates = [variant.merchant_sku, variant.platform_sku, variant.spu, variant.skc]
        if any((candidate or "").strip().lower() == normalized for candidate in candidates):
            return variant
    return None


def _option_value(name: str | None, value: str | None) -> dict | None:
    if not name and not value:
        return None
    return {"name": name, "value": value}

"""Supplier management — with 1688 search using Chinese keywords."""

import urllib.parse
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.sourcing_supplier import SourcingSupplier
from app.services.dictionary import get_all_dicts

ALIBABA_1688_URL = "https://www.1688.com/"


def build_1688_search_url(query: str) -> str:
    """Build a 1688 search URL using GBK encoding.

    1688 (Alibaba) uses GBK/GB2312 encoding for Chinese characters in URLs,
    NOT UTF-8. If we UTF-8 encode Chinese text, 1688 decodes the bytes as
    GBK, producing garbled search results.

    This function detects Chinese characters and encodes them as GBK.
    Non-Chinese text (ASCII) is left raw for readability.
    """
    import re
    # Check if the query contains Chinese characters
    has_chinese = bool(re.search(r'[一-鿿㐀-䶿豈-﫿]', query))
    if has_chinese:
        # Encode Chinese characters as GBK + URL encode the bytes
        # Note: GBK doesn't support all Unicode characters (e.g. emoji, rare CJK)
        # Fall back to UTF-8 if GBK encoding fails
        try:
            encoded_bytes = query.encode('gbk')
            encoded = ''.join(f'%{b:02X}' for b in encoded_bytes)
        except UnicodeEncodeError:
            encoded = urllib.parse.quote(query)
        return f"https://s.1688.com/selloffer/offer_search.htm?keywords={encoded}&n=y"
    else:
        # ASCII-only text: standard URL encoding
        encoded = urllib.parse.quote(query)
        return f"https://s.1688.com/selloffer/offer_search.htm?keywords={encoded}&n=y"


async def list_suppliers(db: AsyncSession, sourcing_item_id: str, user_id: str) -> list[SourcingSupplier]:
    result = await db.execute(
        select(SourcingSupplier).where(
            SourcingSupplier.sourcing_item_id == sourcing_item_id,
            SourcingSupplier.user_id == user_id,
        ).order_by(SourcingSupplier.is_preferred.desc(), SourcingSupplier.created_at.desc())
    )
    return list(result.scalars().all())


async def create_supplier(db: AsyncSession, user_id: str, data: dict) -> SourcingSupplier:
    s = SourcingSupplier(
        user_id=user_id,
        sourcing_item_id=data["sourcing_item_id"],
        supplier_name=data.get("supplier_name", ""),
        supplier_url=data.get("supplier_url"),
        product_image=data.get("product_image"),
        purchase_price_rmb=data.get("purchase_price_rmb"),
        shipping_estimate_rmb=data.get("shipping_estimate_rmb"),
        moq=data.get("moq"),
        notes=data.get("notes"),
        rating=data.get("rating"),
        is_preferred=data.get("is_preferred", False),
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


async def delete_supplier(db: AsyncSession, supplier_id: str, user_id: str) -> bool:
    r = await db.execute(
        delete(SourcingSupplier).where(
            SourcingSupplier.id == supplier_id,
            SourcingSupplier.user_id == user_id,
        )
    )
    await db.commit()
    return r.rowcount > 0


async def search_1688_suppliers(db: AsyncSession, product_name: str, category: Optional[str] = None) -> list[dict]:
    """Generate 1688 supplier search suggestions using Chinese keywords.

    The key insight: 1688 is a Chinese platform, so search queries MUST be
    in Chinese. English product names won't find suppliers on 1688.
    """
    category_item = await _find_category_item(db, category)
    suggestions = []
    seen = set()

    # 1. Category-based Chinese keyword search from unified dictionary.
    if category_item:
        keywords = category_item.get("keywords") or category_item.get("extra", {}).get("keywords") or []
        cn_keywords = " ".join([str(k).strip() for k in keywords if str(k).strip()][:4])
        if not cn_keywords:
            cn_keywords = category_item.get("label", "")
        suggestions.append({
            "query": cn_keywords,
            "url": build_1688_search_url(cn_keywords),
            "type": "category_cn",
            "label": f"品类主词: {cn_keywords}",
        })
        seen.add(cn_keywords)
        cn_label = category_item.get("label", "")
        if cn_label not in seen:
            suggestions.append({
                "query": cn_label,
                "url": build_1688_search_url(cn_label),
                "type": "category_cn",
                "label": f"品类中文: {cn_label}",
            })
            seen.add(cn_label)

    # 2. Product name supplied by the user or discovery module.
    if product_name and product_name not in seen:
        suggestions.append({
            "query": product_name[:50],
            "url": build_1688_search_url(product_name[:50]),
            "type": "product_name",
            "label": f"产品名搜: {product_name[:25]}...",
        })
        seen.add(product_name[:50])

    return suggestions


async def _find_category_item(db: AsyncSession, category: Optional[str]) -> Optional[dict]:
    """Find category by id or label from the unified system dictionary."""
    if not category:
        return None
    dictionaries = await get_all_dicts(db)
    for item in dictionaries.get("categories", []):
        if item.get("id") == category or item.get("label") == category:
            return item
    return None

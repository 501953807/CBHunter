"""Product discovery service - manages the product selection pipeline.

Handles:
- Image upload and OCR-based feature extraction
- Trend matching and scoring
- Full selection workflow (discover → analyze → decide)
"""

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, or_

from app.models.product_discovery import ProductDiscovery
from app.models.trend_keyword import TrendKeyword
from app.services import config_service

logger = logging.getLogger(__name__)

# Image storage directory
IMAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "discovery_images")

def ensure_image_dir():
    """Create image directory if it doesn't exist."""
    os.makedirs(IMAGE_DIR, exist_ok=True)


def extract_features_from_text(text: str, category_keywords: list[str]) -> dict:
    """Match OCR text against keywords maintained in the category dictionary."""
    found_features = []

    if not text:
        return {"features": [], "confidence": 0}

    text_lower = text.lower()
    for keyword in category_keywords:
        if keyword.lower() in text_lower:
            found_features.append(keyword)
    confidence = len(found_features) / max(len(category_keywords), 1)

    # Extract price patterns
    price_patterns = re.findall(r'(?:RM|MYR|¥|PHP|SGD)?\s*(\d+[\.,]?\d*)', text)
    prices = [float(p.replace(",", ".")) for p in price_patterns[:3] if 1 < float(p.replace(",", ".")) < 9999]

    return {
        "features": found_features,
        "prices_found": prices,
        "confidence": round(min(confidence * 100, 100), 1),
    }


async def create_discovery(
    db: AsyncSession,
    user_id: str,
    data: dict,
) -> ProductDiscovery:
    """Create a new product discovery entry."""
    discovery = ProductDiscovery(
        user_id=user_id,
        source_type=data.get("source_type", "manual"),
        source_image=data.get("source_image"),
        source_url=data.get("source_url"),
        product_name=data.get("product_name", ""),
        product_type=data.get("product_type", ""),
        category=data.get("category", ""),
        market=data.get("market"),
        features=data.get("features", []),
        selling_points=data.get("selling_points", []),
        target_audience=data.get("target_audience", ""),
        notes=data.get("notes", ""),
        tags=data.get("tags", []),
        status="discovered",
    )
    db.add(discovery)
    await db.commit()
    await db.refresh(discovery)
    return discovery


async def list_discoveries(
    db: AsyncSession,
    user_id: str,
    category: Optional[str] = None,
    status: Optional[str] = None,
    decision: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ProductDiscovery], int]:
    """List product discoveries with filters."""
    query = select(ProductDiscovery).where(ProductDiscovery.user_id == user_id)

    if category:
        query = query.where(ProductDiscovery.category == category)
    if status:
        query = query.where(ProductDiscovery.status == status)
    if decision:
        query = query.where(ProductDiscovery.decision == decision)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.order_by(ProductDiscovery.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def analyze_discovery(
    db: AsyncSession,
    discovery_id: str,
    user_id: str,
    ocr_text: Optional[str] = None,
) -> Optional[ProductDiscovery]:
    """Analyze a discovery: extract features and match trends."""
    result = await db.execute(
        select(ProductDiscovery).where(
            ProductDiscovery.id == discovery_id,
            ProductDiscovery.user_id == user_id,
        )
    )
    discovery = result.scalar_one_or_none()
    if not discovery:
        return None

    # Extract features from OCR text
    if ocr_text and discovery.category:
        categories = await config_service.get_categories(db)
        category_config = next(
            (
                category for category in categories
                if category.get("id") == discovery.category or category.get("label") == discovery.category
            ),
            {},
        )
        extracted = extract_features_from_text(ocr_text, category_config.get("keywords", []))
        existing_features = discovery.features or []
        discovery.features = list(set(existing_features + extracted.get("features", [])))

    # Match trend keywords
    trend_score = None
    matched_keywords = []

    if discovery.category and discovery.market:
        trend_result = await db.execute(
            select(TrendKeyword).where(
                or_(TrendKeyword.user_id == user_id, TrendKeyword.user_id.is_(None)),
                TrendKeyword.category == discovery.category,
                TrendKeyword.market == discovery.market,
            )
        )
        trend_keywords = trend_result.scalars().all()

        if trend_keywords:
            trend_score = 0
            discovery_text = (discovery.product_name or "").lower()
            for tk in trend_keywords:
                if tk.keyword.lower() in discovery_text:
                    matched_keywords.append({
                        "keyword": tk.keyword,
                        "direction": tk.trend_direction,
                        "volume": tk.search_volume,
                    })
                    trend_score += 20
                if tk.trend_direction == "rising":
                    trend_score += 5

    discovery.matched_trend_keywords = matched_keywords
    discovery.trend_score = min(trend_score, 100) if trend_score is not None else None
    discovery.status = "trend_analyzed"
    discovery.analyzed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(discovery)
    return discovery


async def update_discovery(
    db: AsyncSession,
    discovery_id: str,
    user_id: str,
    data: dict,
) -> Optional[ProductDiscovery]:
    """Update discovery fields (product_name, category, features, etc.)."""
    result = await db.execute(
        select(ProductDiscovery).where(
            ProductDiscovery.id == discovery_id,
            ProductDiscovery.user_id == user_id,
        )
    )
    discovery = result.scalar_one_or_none()
    if not discovery:
        return None

    for field, value in data.items():
        if value is not None and hasattr(discovery, field):
            setattr(discovery, field, value)

    await db.commit()
    await db.refresh(discovery)
    return discovery


async def reanalyze_discovery(
    db: AsyncSession,
    discovery_id: str,
    user_id: str,
    provider: Optional[str] = None,
) -> Optional[ProductDiscovery]:
    """Re-run AI analysis on a discovery. Optionally switch provider."""
    result = await db.execute(
        select(ProductDiscovery).where(
            ProductDiscovery.id == discovery_id,
            ProductDiscovery.user_id == user_id,
        )
    )
    discovery = result.scalar_one_or_none()
    if not discovery:
        return None

    # Clear previous AI analysis and reset status
    discovery.full_analysis = None
    discovery.status = "discovered"
    discovery.analyzed_at = None
    await db.commit()

    # Re-analyze using AI
    image_path = None
    if discovery.source_image:
        from app.services.discovery_service import IMAGE_DIR
        image_path = os.path.join(IMAGE_DIR, discovery.source_image)
        if not os.path.exists(image_path):
            image_path = None

    if image_path and discovery.market:
        from app.services.ai_analysis import analyze_with_ai
        analysis = await analyze_with_ai(image_path, discovery.market, discovery.category)
        if analysis:
            discovery.full_analysis = analysis
            discovery.status = "ai_analyzed"
            discovery.analyzed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(discovery)
    return discovery


async def update_discovery_decision(
    db: AsyncSession,
    discovery_id: str,
    user_id: str,
    decision: str,
    reason: Optional[str] = None,
) -> Optional[ProductDiscovery]:
    """Make a decision on a discovery (pursue/maybe/reject)."""
    result = await db.execute(
        select(ProductDiscovery).where(
            ProductDiscovery.id == discovery_id,
            ProductDiscovery.user_id == user_id,
        )
    )
    discovery = result.scalar_one_or_none()
    if not discovery:
        return None

    discovery.decision = decision
    discovery.decision_reason = reason
    discovery.decided_at = datetime.now(timezone.utc)
    discovery.status = "decision_made"

    await db.commit()
    await db.refresh(discovery)
    return discovery


async def get_discovery_stats(db: AsyncSession, user_id: str) -> dict:
    """Get pipeline statistics."""
    result = await db.execute(
        select(ProductDiscovery).where(ProductDiscovery.user_id == user_id)
    )
    all_items = list(result.scalars().all())

    stats = {
        "total": len(all_items),
        "by_status": {},
        "by_decision": {},
        "by_category": {},
    }

    for item in all_items:
        stats["by_status"][item.status] = stats["by_status"].get(item.status, 0) + 1
        if item.decision:
            stats["by_decision"][item.decision] = stats["by_decision"].get(item.decision, 0) + 1
        if item.category:
            stats["by_category"][item.category] = stats["by_category"].get(item.category, 0) + 1

    return stats

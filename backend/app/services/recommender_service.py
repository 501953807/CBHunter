"""Evidence-backed product recommendation assembly."""

from datetime import datetime, timezone
from statistics import mean
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.competitor_product import CompetitorProduct
from app.models.sourcing_item import SourcingItem
from app.models.supply_product import SupplyProduct
from app.models.trend_keyword import TrendKeyword
from app.models.trending_product import TrendingProduct
from app.services.business_work_item_service import enrich_recommendation_work_state
from app.services.evidence_service import data_required, evidence_payload, source_ref, unique_refs
from app.services.recommender_projection_service import enrich_recommendation_product_context

RULE_MINIMUMS = {
    "candidate_products": 1,
    "trend_signals": 1,
    "competitor_products": 1,
    "supply_products": 1,
}
MODEL_TRAINING_MINIMUM = 100


def evaluate_readiness(counts: dict[str, int]) -> dict:
    """Describe what current real data can support without overstating AI capability."""
    rule_gaps = [
        key for key, minimum in RULE_MINIMUMS.items()
        if counts.get(key, 0) < minimum
    ]
    historical_outcomes = counts.get("historical_outcomes", 0)
    actions = {
        "candidate_products": "采集目标平台热卖商品，或采集并启用 1688 供应商品",
        "trend_signals": "采集目标市场趋势词并保留搜索量、增长率等真实指标",
        "competitor_products": "采集并跟踪目标平台竞品",
        "supply_products": "通过浏览器扩展采集 1688 真实供应商品",
    }
    required_actions = [actions[key] for key in rule_gaps]
    if historical_outcomes < MODEL_TRAINING_MINIMUM:
        required_actions.append(
            f"积累至少 {MODEL_TRAINING_MINIMUM} 条包含实际销量和利润率的历史选品结果"
        )
    return {
        "rules_decision_status": "ready" if not rule_gaps else "data_required",
        "model_training_status": (
            "ready" if historical_outcomes >= MODEL_TRAINING_MINIMUM else "data_required"
        ),
        **evidence_payload(
            source_refs=[],
            evidence_window="当前平台、市场、趋势、竞品、1688供应和历史选品结果快照",
            confidence_reason="规则决策和模型训练就绪度仅基于真实数据计数判断。",
            data_gaps=rule_gaps + ([] if historical_outcomes >= MODEL_TRAINING_MINIMUM else ["historical_outcomes"]),
        ),
        "counts": counts,
        "minimums": {
            **RULE_MINIMUMS,
            "historical_outcomes": MODEL_TRAINING_MINIMUM,
        },
        "rule_gaps": rule_gaps,
        "required_actions": required_actions,
        "note": (
            "规则决策使用真实资料评分；模型训练仅在历史结果达到最低样本量后才标记可用。"
        ),
    }


async def get_recommender_readiness(
    db: AsyncSession,
    user_id: str,
    platform: str,
    market: str,
) -> dict:
    """Count real evidence available for automated product-selection decisions."""

    async def count(model, *conditions) -> int:
        value = await db.scalar(select(func.count(model.id)).where(*conditions))
        return int(value or 0)

    trending_count = await count(
        TrendingProduct,
        TrendingProduct.user_id == user_id,
        TrendingProduct.platform == platform,
        TrendingProduct.market == market,
    )
    supply_count = await count(
        SupplyProduct,
        SupplyProduct.user_id == user_id,
        SupplyProduct.is_active.is_(True),
    )
    counts = {
        "candidate_products": trending_count + supply_count,
        "trend_signals": await count(
            TrendKeyword,
            or_(TrendKeyword.user_id == user_id, TrendKeyword.user_id.is_(None)),
            or_(TrendKeyword.market == market, TrendKeyword.market.is_(None)),
            or_(
                TrendKeyword.search_volume.is_not(None),
                TrendKeyword.growth_pct.is_not(None),
                TrendKeyword.cross_validation_score.is_not(None),
            ),
        ),
        "competitor_products": await count(
            CompetitorProduct,
            CompetitorProduct.user_id == user_id,
            CompetitorProduct.platform == platform,
        ),
        "supply_products": supply_count,
        "historical_outcomes": await count(
            SourcingItem,
            SourcingItem.user_id == user_id,
            SourcingItem.platform == platform,
            SourcingItem.market == market,
            SourcingItem.monthly_sales.is_not(None),
            SourcingItem.profit_margin_pct.is_not(None),
        ),
    }
    return {
        "platform": platform,
        "market": market,
        **evaluate_readiness(counts),
    }


def _matches(candidate_name: str, candidate_category: Optional[str], name: str, category: Optional[str]) -> bool:
    if candidate_category and category and candidate_category == category:
        return True
    left = candidate_name.casefold()
    right = name.casefold()
    if left in right or right in left:
        return True
    tokens = {token for token in left.replace("-", " ").split() if len(token) > 2}
    return any(token in right for token in tokens)


def _demand_level(search_volume: Optional[int], sales_volume: Optional[int], growth_pct: Optional[float]) -> str:
    if search_volume is None and sales_volume is None and growth_pct is None:
        return "unknown"
    if (search_volume or 0) >= 1000 or (sales_volume or 0) >= 100 or (growth_pct or 0) >= 20:
        return "high"
    if (search_volume or 0) > 0 or (sales_volume or 0) > 0 or (growth_pct or 0) > 0:
        return "medium"
    return "low"


def _competition_level(count: int) -> str:
    if count == 0:
        return "unknown"
    if count >= 10:
        return "high"
    if count >= 3:
        return "medium"
    return "low"


def _profit_level(margins: list[float]) -> str:
    if not margins:
        return "unknown"
    average_margin = mean(margins)
    if average_margin >= 30:
        return "high"
    if average_margin >= 15:
        return "medium"
    return "low"


def _score(
    search_volume: Optional[int],
    sales_volume: Optional[int],
    growth_pct: Optional[float],
    cross_score: Optional[int],
    margins: list[float],
) -> tuple[int, str]:
    signals: list[float] = []
    reasons: list[str] = []
    if search_volume is not None:
        signals.append(min(search_volume / 20, 100))
        reasons.append("趋势搜索量")
    if sales_volume is not None:
        signals.append(min(sales_volume / 5, 100))
        reasons.append("平台销量")
    if growth_pct is not None:
        signals.append(max(0, min(50 + growth_pct, 100)))
        reasons.append("增长率")
    if cross_score is not None:
        signals.append(cross_score)
        reasons.append("跨源验证")
    if margins:
        signals.append(max(0, min(mean(margins) * 2, 100)))
        reasons.append("历史利润率")
    if not signals:
        return 0, "仅有商品或供应链记录，尚无可评分的趋势、销量或利润资料"
    return round(mean(signals)), "、".join(reasons)


def _decision(score: int, gaps: list[str]) -> dict:
    """Map evidence score to a traffic-light product-selection decision."""
    if score >= 75 and len(gaps) <= 1:
        return {
            "decision_level": "green",
            "decision_label": "绿灯：进入打样/上架准备",
            "decision_action": "优先补齐最后资料后推进内容制作、平台校验和试刊登。",
        }
    if score >= 45:
        return {
            "decision_level": "yellow",
            "decision_label": "黄灯：继续验证",
            "decision_action": "补充缺失的趋势、竞品、1688供应或利润资料后再投入上架。",
        }
    return {
        "decision_level": "red",
        "decision_label": "红灯：暂缓投入",
        "decision_action": "先不要进入内容制作和刊登，优先补采信号或替换候选品。",
    }


def _price_range(products: list[SupplyProduct]) -> Optional[str]:
    prices = [price for item in products for price in (item.price_min, item.price_max) if price is not None]
    if not prices:
        return None
    low, high = min(prices), max(prices)
    return f"¥{low:.2f}" if low == high else f"¥{low:.2f} - ¥{high:.2f}"


def _source_label(source_type: str) -> str:
    if source_type == "supply_product":
        return "1688供应商品"
    if source_type == "trending_product":
        return "平台热卖商品"
    return "候选商品"


def _image_list(item: object) -> list[str]:
    images = getattr(item, "images", None)
    if not isinstance(images, list):
        return []
    return [str(image) for image in images if isinstance(image, str) and image.strip()]


def _source_image(item: object) -> Optional[str]:
    image = getattr(item, "source_image", None)
    return image if isinstance(image, str) and image.strip() else None


def _source_url(item: object) -> Optional[str]:
    for field in ("product_url", "source_url", "listing_url"):
        url = getattr(item, field, None)
        if isinstance(url, str) and url.strip():
            return url
    return None


def _media_context(
    source_type: str,
    source_item: object,
    related_supply: list[SupplyProduct],
    related_sourcing: list[SourcingItem],
) -> dict:
    images: list[str] = []
    images.extend(_image_list(source_item))
    for item in related_supply:
        images.extend(_image_list(item))
    for item in related_sourcing:
        source_image = _source_image(item)
        if source_image:
            images.append(source_image)
    unique_images = list(dict.fromkeys(images))
    source_url = _source_url(source_item)
    if not source_url:
        source_url = next((_source_url(item) for item in related_supply + related_sourcing if _source_url(item)), None)
    return {
        "image_url": unique_images[0] if unique_images else None,
        "image_count": len(unique_images),
        "source_url": source_url,
        "source_label": _source_label(source_type),
    }


async def build_recommendation_bundle(
    db: AsyncSession,
    user_id: str,
    platform: str,
    market: str,
    category: Optional[str] = None,
) -> dict:
    trending = list((await db.execute(
        select(TrendingProduct).where(
            TrendingProduct.user_id == user_id,
            TrendingProduct.platform == platform,
        ).order_by(TrendingProduct.sales_volume.desc()).limit(100)
    )).scalars().all())
    trending = [
        item for item in trending
        if (not market or item.market == market or market in (item.tags or []))
        and (not category or item.category_path == category)
    ]
    supply = list((await db.execute(
        select(SupplyProduct).where(
            SupplyProduct.user_id == user_id,
            SupplyProduct.is_active.is_(True),
        ).order_by(SupplyProduct.sales_volume.desc()).limit(100)
    )).scalars().all())
    if category:
        supply = [item for item in supply if item.category_path == category]
    competitors = list((await db.execute(
        select(CompetitorProduct).where(
            CompetitorProduct.user_id == user_id,
            CompetitorProduct.platform == platform,
        )
    )).scalars().all())
    sourcing = list((await db.execute(
        select(SourcingItem).where(
            SourcingItem.user_id == user_id,
            or_(SourcingItem.platform == platform, SourcingItem.platform.is_(None)),
        )
    )).scalars().all())
    sourcing = [item for item in sourcing if not market or item.market in (None, "", market)]
    trends = list((await db.execute(
        select(TrendKeyword).where(
            or_(TrendKeyword.user_id == user_id, TrendKeyword.user_id.is_(None)),
            or_(TrendKeyword.market == market, TrendKeyword.market.is_(None)),
        )
    )).scalars().all())
    if category:
        trends = [item for item in trends if item.category in (None, "", category)]

    candidates: list[tuple[str, Optional[str], str, object]] = []
    seen: set[str] = set()
    for source, items in (("trending_product", trending), ("supply_product", supply)):
        for item in items:
            key = item.name.casefold()
            if key in seen:
                continue
            seen.add(key)
            candidates.append((item.name, item.category_path, source, item))

    recommendations = []
    for name, item_category, source_type, source_item in candidates[:30]:
        related_trends = [item for item in trends if _matches(name, item_category, item.keyword, item.category)]
        related_competitors = [item for item in competitors if _matches(name, item_category, item.name, None)]
        related_supply = [item for item in supply if _matches(name, item_category, item.name, item.category_path)]
        related_sourcing = [item for item in sourcing if _matches(name, item_category, item.product_name, item.category)]

        search_volume = max((item.search_volume for item in related_trends if item.search_volume is not None), default=None)
        growth_pct = max((item.growth_pct for item in related_trends if item.growth_pct is not None), default=None)
        cross_score = max((item.cross_validation_score for item in related_trends if item.cross_validation_score is not None), default=None)
        sales_volume = getattr(source_item, "sales_volume", None)
        margins = [item.profit_margin_pct for item in related_sourcing if item.profit_margin_pct is not None]
        competitor_prices = [item.price for item in related_competitors if item.price is not None]
        source_prices = [
            price for price in (getattr(source_item, "price_min", None), getattr(source_item, "price_max", None))
            if price is not None
        ]
        local_prices = competitor_prices + source_prices if source_type == "trending_product" else competitor_prices
        actual_local_price = round(mean(local_prices), 2) if local_prices else None
        cny_prices = [
            price for item in related_supply for price in (item.price_min, item.price_max) if price is not None
        ]
        actual_cny_price = round(mean(cny_prices), 2) if cny_prices else getattr(source_item, "price_cny", None)
        score, confidence_reason = _score(search_volume, sales_volume, growth_pct, cross_score, margins)

        source_refs = [source_ref(source_type, source_item.id)]
        source_refs.extend(source_ref("trend_keyword", item.id) for item in related_trends[:5])
        source_refs.extend(source_ref("competitor_product", item.id) for item in related_competitors[:5])
        source_refs.extend(source_ref("supply_product", item.id) for item in related_supply[:5])
        source_refs.extend(source_ref("sourcing_item", item.id) for item in related_sourcing[:5])
        gaps = []
        if not related_trends:
            gaps.append("缺趋势资料")
        if not related_competitors:
            gaps.append("缺竞品资料")
        if not related_supply:
            gaps.append("缺1688供应资料")
        if not margins:
            gaps.append("缺历史利润资料")
        decision = _decision(score, gaps)
        media_context = _media_context(source_type, source_item, related_supply, related_sourcing)

        recommendation = {
            "category": item_category,
            "product_name": name,
            "product_name_cn": name,
            **media_context,
            "target_platform": platform,
            "target_market": market,
            "score": score,
            "demand_level": _demand_level(search_volume, sales_volume, growth_pct),
            "search_volume": search_volume,
            "competition_level": _competition_level(len(related_competitors)),
            "avg_price_local": actual_local_price,
            "avg_price_rmb_equivalent": actual_cny_price,
            "suggested_sourcing_price_rmb": _price_range(related_supply),
            "suggested_selling_price_local": actual_local_price,
            "profit_potential": _profit_level(margins),
            "keywords": [item.keyword for item in related_trends[:8]],
            "listing_tips": gaps,
            "trend_direction": related_trends[0].trend_direction if related_trends else None,
            "seasonal": any(item.trend_direction == "seasonal" for item in related_trends),
            **decision,
            **evidence_payload(
                source_refs=unique_refs(source_refs),
                evidence_window="当前数据库最新采集快照",
                confidence_reason=confidence_reason,
                data_gaps=gaps,
            ),
        }
        recommendation_with_state = enrich_recommendation_work_state(
            recommendation,
            source_type,
            source_item.id,
            name,
        )
        recommendations.append(enrich_recommendation_product_context(recommendation_with_state))

    recommendations.sort(key=lambda item: item["score"], reverse=True)
    categories = sorted({item["category"] for item in recommendations if item["category"]})
    missing_payload = {} if recommendations else data_required(
        "需要先采集目标平台热卖商品或1688供应商品，系统不会生成静态样例推荐。",
        data_gaps=["candidate_products", "trend_signals", "competitor_products", "supply_products"],
        evidence_window="当前数据库最新采集快照",
    )
    return {
        "platform": platform,
        "market": market,
        "status": "ready" if recommendations else "data_required",
        "note": None if recommendations else missing_payload["message"],
        **missing_payload,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "available_categories": categories,
        "total_recommendations": len(recommendations),
        "high_demand_count": sum(1 for item in recommendations if item["demand_level"] == "high"),
        "high_profit_count": sum(1 for item in recommendations if item["profit_potential"] == "high"),
        "recommendations": recommendations,
    }

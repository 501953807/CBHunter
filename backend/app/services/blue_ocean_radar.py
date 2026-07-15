"""Blue Ocean Radar — automated product opportunity discovery engine.

Core algorithm: Blue Ocean Score (0-100)
  = Trend Strength × 0.30
  + Profit Potential × 0.25
  + Competition Gap × 0.25
  + Supply Chain Maturity × 0.20

Each available dimension is scored 0-100. Missing dimensions are excluded and
reported explicitly, so a lack of competitor or profit data cannot become a
high opportunity score.

Scoring calibration improves over time as real operational data flows in.
"""

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select

from app.models.trend_keyword import TrendKeyword
from app.models.sourcing_item import SourcingItem
from app.services.evidence_service import evidence_payload, source_ref


async def scan_blue_ocean(
    db: AsyncSession,
    user_id: str,
    market: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 10,
    min_score: int = 0,
) -> list[dict]:
    """Scan for blue ocean product opportunities.

    Returns ranked list of opportunity cards, each containing:
      - keyword, market, category
      - blue_ocean_score (0-100)
      - dimension scores (trend, profit, competition, supply_chain)
      - opportunity_level (high/medium/low)
      - real sourcing/profit data status
      - action recommendation
    """
    # Query all trend keywords
    query = select(TrendKeyword).where(
        or_(TrendKeyword.user_id == user_id, TrendKeyword.user_id.is_(None))
    )
    if market:
        query = query.where(TrendKeyword.market == market)
    if category:
        query = query.where(TrendKeyword.category == category)

    result = await db.execute(query)
    keywords = list(result.scalars().all())

    internal_products = await _count_internal_products(db, user_id)
    sourcing_signals = await _load_sourcing_signals(db, user_id)

    opportunities = []
    for kw in keywords:
        scores = _score_keyword(kw, internal_products, sourcing_signals)
        if scores["blue_ocean_score"] >= min_score:
            opportunities.append(scores)

    # Sort by score descending
    opportunities.sort(key=lambda x: x["blue_ocean_score"], reverse=True)
    top = opportunities[:limit]

    return [
        {
            **o,
            "rank": i + 1,
            "opportunity_level": _level_label(o["blue_ocean_score"], o["missing_dimensions"]),
            "recommendation": _generate_recommendation(o),
            **evidence_payload(
                source_refs=o["source_refs"],
                evidence_window="当前趋势词、选品库成本利润和供应链信号快照",
                confidence_reason="蓝海分数只用存在真实数据的维度参与归一化，缺失维度单独返回，不按默认值补分。",
                data_gaps=o["data_gaps"],
            ),
        }
        for i, o in enumerate(top)
    ]


def _score_keyword(kw: TrendKeyword, internal_products: dict, sourcing_signals: dict) -> dict:
    """Calculate Blue Ocean Score for a single keyword."""
    market = kw.market or "unknown"
    category = kw.category or "unknown"

    # ── Dimension 1: Trend Strength (0-100) ──
    trend_components = []
    if kw.search_volume is not None:
        trend_components.append(min(100, kw.search_volume / 2))
    if kw.growth_pct is not None:
        trend_components.append(min(100, max(0, 50 + kw.growth_pct * 2)))  # -25%→0, 0%→50, +25%→100
    direction_bonus = {"rising": 20, "stable": 0, "falling": -20, "seasonal": 10}.get(
        kw.trend_direction, 0)
    if trend_components:
        trend_strength = max(0, min(100, sum(trend_components) / len(trend_components) + direction_bonus))
    elif kw.trend_direction:
        trend_strength = max(0, min(100, 50 + direction_bonus))
    else:
        trend_strength = None

    # Cross-validation bonus: Pinterest data adds confidence
    if trend_strength is not None and kw.has_pinterest_data:
        trend_strength = min(100, trend_strength + 10)
    if trend_strength is not None and kw.cross_validation_score and kw.cross_validation_score >= 60:
        trend_strength = min(100, trend_strength + 10)

    # ── Dimension 2: Profit Potential (0-100) ──
    signal_key = f"{category}|{market}"
    signal = sourcing_signals.get(signal_key, {})
    margin_pct = signal.get("avg_margin_pct")
    if margin_pct is None:
        profit_score = None
        profit_status = "profit_data_missing"
    else:
        profit_score = min(100, max(0, margin_pct * 2.5))
        profit_status = "ready"

    # ── Dimension 3: Competition Gap (0-100) ──
    # Only explicit collected competition level is valid competition evidence.
    key = f"{category}|{market}"
    internal_product_count = internal_products.get(key, 0)
    competition_score = {"low": 80, "medium": 50, "high": 20}.get(kw.competition_level)

    # ── Dimension 4: Supply Chain Maturity (0-100) ──
    sourcing_count = signal.get("sourcing_count", 0)
    avg_source_price = signal.get("avg_source_price_rmb")
    supply_score = None
    if sourcing_count > 0:
        supply_score = min(80, sourcing_count * 20)
        if avg_source_price is not None:
            supply_score = min(100, supply_score + 20)

    # ── Blue Ocean Score ──
    weighted_dimensions = (
        ("trend", trend_strength, 0.30),
        ("profit", profit_score, 0.25),
        ("competition", competition_score, 0.25),
        ("supply_chain", supply_score, 0.20),
    )
    available = [(name, score, weight) for name, score, weight in weighted_dimensions if score is not None]
    missing_dimensions = [name for name, score, _ in weighted_dimensions if score is None]
    blue_ocean = round(
        sum(score * weight for _, score, weight in available)
        / sum(weight for _, _, weight in available)
    ) if available else 0

    return {
        "keyword_id": kw.id,
        "keyword": kw.keyword,
        "market": market,
        "category": category,
        "blue_ocean_score": blue_ocean,
        "evidence_completeness_pct": round(len(available) / len(weighted_dimensions) * 100),
        "missing_dimensions": missing_dimensions,
        "data_gaps": _dimension_gaps(missing_dimensions),
        "source_refs": _opportunity_refs(kw, category, market, signal),
        "dimensions": {
            "trend_strength": round(trend_strength) if trend_strength is not None else None,
            "trend_detail": {
                "status": "ready" if trend_components else "trend_data_missing",
                "search_volume": kw.search_volume,
                "growth_pct": kw.growth_pct,
                "direction": kw.trend_direction,
                "has_pinterest": kw.has_pinterest_data,
                "cross_validated": bool(kw.cross_validation_score and kw.cross_validation_score >= 60),
            },
            "profit_potential": round(profit_score) if profit_score is not None else None,
            "profit_detail": {
                "status": profit_status,
                "avg_margin_pct": round(margin_pct, 1) if margin_pct is not None else None,
                "avg_source_price_rmb": round(avg_source_price, 2) if avg_source_price is not None else None,
                "sample_count": sourcing_count,
            },
            "competition_gap": round(competition_score) if competition_score is not None else None,
            "competition_detail": {
                "status": "ready" if competition_score is not None else "competition_data_missing",
                "internal_pipeline_products": internal_product_count,
                "competition_level": kw.competition_level or "unknown",
            },
            "supply_chain": round(supply_score) if supply_score is not None else None,
            "supply_detail": {
                "status": "ready" if sourcing_count > 0 else "sourcing_data_missing",
                "category": category,
                "sourcing_count": sourcing_count,
                "avg_source_price_rmb": round(avg_source_price, 2) if avg_source_price is not None else None,
            },
        },
    }


def _level_label(score: int, missing_dimensions: list[str]) -> str:
    if len(missing_dimensions) >= 2:
        return "资料不足"
    if score >= 75:
        return "高分信号"
    elif score >= 55:
        return "值得关注"
    elif score >= 35:
        return "可观察"
    else:
        return "待更多数据"


def _dimension_gaps(missing_dimensions: list[str]) -> list[str]:
    mapping = {
        "trend": "trend_keywords.search_volume_or_growth",
        "profit": "sourcing_items.profit_margin_pct",
        "competition": "trend_keywords.competition_level",
        "supply_chain": "sourcing_items.source_price_rmb",
    }
    return [mapping.get(item, item) for item in missing_dimensions]


def _opportunity_refs(kw: TrendKeyword, category: str, market: str, signal: dict) -> list[dict]:
    refs = [source_ref("trend_keyword", kw.id, fields=["search_volume", "growth_pct", "competition_level"])]
    if signal.get("sourcing_count"):
        refs.append(source_ref(
            "sourcing_items",
            f"{category}|{market}",
            fields=["source_price_rmb", "profit_margin_pct"],
            label="同品类同市场选品聚合",
            meta={"sample_count": signal.get("sourcing_count")},
        ))
    return refs


def _generate_recommendation(o: dict) -> str:
    """Generate a human-readable recommendation."""
    dims = o["dimensions"]
    profit = dims["profit_detail"]
    comp = dims["competition_detail"]
    trend = dims["trend_detail"]

    parts = [
        f"关键词「{o['keyword']}」在{o['market']}市场的可用资料得分{o['blue_ocean_score']}分",
        f"资料完整度{o['evidence_completeness_pct']}%",
    ]

    if o["missing_dimensions"]:
        parts.append(f"缺少{','.join(o['missing_dimensions'])}资料，暂不生成入场结论")
    else:
        parts.append("请结合样品、平台规则和现金流进行人工决策")

    if profit.get("avg_margin_pct") is not None and profit["avg_margin_pct"] >= 25:
        parts.append(f"历史选品平均利润率{profit['avg_margin_pct']}%，盈利空间充足")
    elif profit.get("status") == "profit_data_missing":
        parts.append("缺少真实售价/成本利润数据，暂不判断利润空间")
    if comp.get("competition_level") != "unknown":
        parts.append(f"已采集竞争等级为{comp['competition_level']}")
    if trend.get("growth_pct") and trend["growth_pct"] > 20:
        parts.append(f"增长率{trend['growth_pct']:.0f}%，趋势强劲")

    return "；".join(parts)


async def _count_internal_products(db: AsyncSession, user_id: str) -> dict[str, int]:
    """Count the user's pipeline products without treating them as competitors."""
    result = await db.execute(
        select(
            SourcingItem.category,
            SourcingItem.market,
            func.count(SourcingItem.id),
        ).where(
            SourcingItem.user_id == user_id,
            SourcingItem.pipeline_stage.in_(
                ["discovery", "jit_testing", "jit_passed", "price_review", "vmi", "active"]
            )
        ).group_by(SourcingItem.category, SourcingItem.market)
    )
    counts = {}
    for row in result.all():
        cat, mkt, cnt = row
        if cat and mkt:
            counts[f"{cat}|{mkt}"] = cnt
    return counts


async def _load_sourcing_signals(db: AsyncSession, user_id: str) -> dict[str, dict]:
    """Load current user's real sourcing cost and margin signals per category+market."""
    result = await db.execute(
        select(
            SourcingItem.category,
            SourcingItem.market,
            func.count(SourcingItem.id),
            func.avg(SourcingItem.source_price_rmb),
            func.avg(SourcingItem.profit_margin_pct),
        ).where(
            SourcingItem.user_id == user_id,
            SourcingItem.is_active.is_(True),
        ).group_by(SourcingItem.category, SourcingItem.market)
    )
    signals = {}
    for category, market, count, avg_source_price, avg_margin in result.all():
        if category and market:
            signals[f"{category}|{market}"] = {
                "sourcing_count": count or 0,
                "avg_source_price_rmb": avg_source_price,
                "avg_margin_pct": avg_margin,
            }
    return signals

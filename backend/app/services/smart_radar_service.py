"""Smart Radar service — Shopee competition analysis + 1688 cross-validation + exchange rates."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.integrations.shopee.scraper import analyze_competition as shopee_analyze, batch_analyze
from app.integrations.alibaba.hotwords import discover_hot_keywords, get_suggestions
from app.models.fee_template import FeeTemplate
from app.models.exchange_rate import ExchangeRate

logger = logging.getLogger(__name__)

async def search_shopee_keywords(
    db: AsyncSession,
    keywords: list[str],
    market: str,
) -> list[dict]:
    """Run Shopee competition analysis for multiple keywords."""
    from app.services import config_service

    market_configs = {
        item["id"].upper(): item for item in await config_service.get_markets(db)
    }
    kw_data = [{"keyword": kw, "market": market} for kw in keywords]
    return await batch_analyze(kw_data, market_configs, concurrency=3)


async def cross_validate_1688(
    db: AsyncSession,
    market: str,
    min_popularity: int = 0,
    limit: int = 20,
) -> list[dict]:
    """Cross-validate 1688 hot keywords against Shopee competition.

    Flow:
    1. Discover trending keywords from 1688
    2. For each keyword, run Shopee competition analysis
    3. Compare explicit 1688 popularity with observed Shopee competition
    """
    # Step 1: Get 1688 hot keywords
    from app.services import config_service

    categories = await config_service.get_categories(db)
    market_configs = {
        item["id"].upper(): item for item in await config_service.get_markets(db)
    }
    hotwords = await discover_hot_keywords(categories, max_depth=2)
    if min_popularity:
        hotwords = [h for h in hotwords if (h.get("popularity") or 0) >= min_popularity]

    # Take top N
    hotwords = hotwords[:limit]

    # Step 2: Run Shopee analysis in parallel batches
    # Use Chinese keyword directly since Shopee search handles multi-language
    kw_data = [{"keyword": h["keyword"], "market": market} for h in hotwords]
    shopee_results = await batch_analyze(kw_data, market_configs, concurrency=3)

    # Step 3: Cross-validation scoring
    results = []
    for hw, sr in zip(hotwords, shopee_results):
        if sr.get("error"):
            continue

        popularity = hw.get("popularity")
        pop_score = min(100, popularity / 5) if popularity is not None else None
        blue_score = sr.get("competition_score")
        cross_score = (
            round(pop_score * 0.3 + blue_score * 0.7)
            if pop_score is not None and blue_score is not None
            else None
        )
        status = "ready" if cross_score is not None else "data_incomplete"

        results.append({
            "keyword_1688": hw["keyword"],
            "source_category": hw.get("source_category", ""),
            "cross_border_category": hw.get("cross_border_category", ""),
            "popularity_1688": hw.get("popularity"),
            "shopee_total_products": sr.get("total_results"),
            "shopee_competition_score": blue_score,
            "shopee_avg_price": sr.get("avg_price"),
            "cross_validation_score": cross_score,
            "is_opportunity": cross_score is not None and cross_score >= 60,
            "market": market,
            "data_status": status,
            "recommendation": (
                f"交叉信号得分{cross_score}，请结合真实成本、利润和竞品详情人工评估。"
                if cross_score is not None else
                "1688热度或 Shopee 竞争数据缺失，暂不生成机会判断。"
            ),
        })

    return sorted(
        results,
        key=lambda x: x["cross_validation_score"] if x["cross_validation_score"] is not None else -1,
        reverse=True,
    )


async def get_fee_templates(
    db: AsyncSession,
    platform: Optional[str] = None,
) -> list[dict]:
    """Get fee templates from DB."""
    query = select(FeeTemplate).where(FeeTemplate.is_active == True)
    if platform:
        query = query.where(FeeTemplate.platform == platform)

    result = await db.execute(query)
    templates = result.scalars().all()

    return [
        {
            "id": t.id,
            "platform": t.platform,
            "market": t.market,
            "commission_pct": t.commission_pct,
            "transaction_fee_pct": t.transaction_fee_pct,
            "tech_service_pct": t.tech_service_pct,
            "shipping_subsidy": t.shipping_subsidy,
            "free_shipping_threshold": t.free_shipping_threshold,
            "vat_pct": t.vat_pct,
            "notes": t.notes,
        }
        for t in templates
    ]


async def save_fee_template(db: AsyncSession, template: dict) -> FeeTemplate:
    """Save or update a fee template."""
    existing = await db.execute(
        select(FeeTemplate).where(
            FeeTemplate.platform == template["platform"],
            FeeTemplate.market == template["market"],
        )
    )
    t = existing.scalar_one_or_none()

    if t:
        for key in ["commission_pct", "transaction_fee_pct", "tech_service_pct",
                     "shipping_subsidy", "free_shipping_threshold", "vat_pct", "notes"]:
            if key in template:
                setattr(t, key, template[key])
        t.updated_at = datetime.now(timezone.utc)
    else:
        required_fees = ("commission_pct", "transaction_fee_pct", "tech_service_pct")
        missing = [key for key in required_fees if template.get(key) is None]
        if missing:
            raise ValueError(f"缺少必填费率字段: {', '.join(missing)}")
        from app.models.fee_template import FeeTemplate as FT
        import uuid
        t = FT(
            id=str(uuid.uuid4()),
            platform=template["platform"],
            market=template["market"],
            commission_pct=template["commission_pct"],
            transaction_fee_pct=template["transaction_fee_pct"],
            tech_service_pct=template["tech_service_pct"],
            shipping_subsidy=template.get("shipping_subsidy"),
            free_shipping_threshold=template.get("free_shipping_threshold"),
            vat_pct=template.get("vat_pct"),
            notes=template.get("notes", ""),
        )
        db.add(t)

    await db.commit()
    await db.refresh(t)
    return t


async def get_latest_exchange_rates(db: AsyncSession) -> list[dict]:
    """Get latest exchange rates from DB."""
    from app.services import config_service

    target_currencies = {
        (market.get("currency") or "").upper()
        for market in await config_service.get_markets(db)
        if market.get("currency") and market.get("currency") != "CNY"
    }
    if not target_currencies:
        return []
    # Subquery for latest rate per currency
    subq = (
        select(
            ExchangeRate.to_currency,
            func.max(ExchangeRate.fetched_at).label("max_fetched"),
        )
        .where(ExchangeRate.to_currency.in_(target_currencies))
        .group_by(ExchangeRate.to_currency)
        .subquery()
    )

    result = await db.execute(
        select(ExchangeRate).join(
            subq,
            (ExchangeRate.to_currency == subq.c.to_currency)
            & (ExchangeRate.fetched_at == subq.c.max_fetched),
        )
    )
    rates = result.scalars().all()

    return [
        {
            "from_currency": r.from_currency,
            "to_currency": r.to_currency,
            "rate": r.rate,
            "source": r.source,
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
        }
        for r in rates
    ]

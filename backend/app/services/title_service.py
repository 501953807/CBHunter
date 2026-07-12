"""爆款标题生成服务 — 五步法生成多平台适配标题.

流程:
  Step 1: 基础信息提取 → 属性词集(品类/风格/材质/功能/场景/颜色/人群)
  Step 2: 趋势热词融合 → 从 TrendKeyword 查询该品类+市场的热词
  Step 3: 平台搜索词补充 → 从 TrendingProduct 竞品标题提取高频词
  Step 4: 按平台规则组装 → Shopee/TEMU/TikTok Shop 不同规则
  Step 5: AI 优化润色 → 最终候选标题
"""
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, select

from app.models.trend_keyword import TrendKeyword
from app.models.trending_product import TrendingProduct
from app.services import config_service
from app.services.evidence_service import configuration_required, evidence_payload, source_ref, unique_refs

logger = logging.getLogger(__name__)

async def generate_titles(
    db: AsyncSession,
    user_id: str,
    data: dict,
) -> dict:
    """Five-step title generation."""
    product_name = data.get("product_name", "")
    category = data.get("category", "")
    platform = data.get("platform", "")
    market = data.get("market", "")
    features = data.get("features", "")
    material = data.get("material", "")
    target_audience = data.get("target_audience", "")
    scenes = data.get("scenes", "")

    platform_config = next(
        (item for item in await config_service.get_platforms(db) if item["id"] == platform),
        None,
    )
    rule = (platform_config or {}).get("title_rule")
    if not rule:
        return {
            "titles": [],
            "platform": platform,
            "market": market,
            "note": "目标平台未配置标题规则，请先在统一平台字典中维护 title_rule。",
            "rules": None,
            "keywords": {"attribute_words": [], "trend_words": [], "competitor_words": []},
            **configuration_required(
                "目标平台未配置标题规则，请先在统一平台字典中维护 title_rule。",
                data_gaps=["platform.title_rule"],
                evidence_window="当前平台字典配置",
                confidence_reason="缺少平台标题规则，未生成标题",
            ),
        }

    # Step 1: Build basic attribute word set
    attr_words = [product_name]
    if features:
        attr_words.extend([f.strip() for f in features.split(",") if f.strip()])
    if material:
        attr_words.extend([m.strip() for m in material.split(",") if m.strip()])
    if scenes:
        attr_words.extend([s.strip() for s in scenes.split(",") if s.strip()])

    # Step 2: Merge trend keywords from database
    trend_words = []
    source_refs = [source_ref("merchant_input", fields=[
        key for key, value in data.items() if value not in (None, "", [], {})
    ])]
    if category:
        result = await db.execute(
            select(TrendKeyword).where(
                or_(TrendKeyword.user_id == user_id, TrendKeyword.user_id.is_(None)),
                TrendKeyword.category == category,
                TrendKeyword.market == market,
            ).order_by(TrendKeyword.search_volume.desc().nullslast()).limit(10)
        )
        for kw in result.scalars().all():
            trend_words.append(kw.keyword)
            source_refs.append(source_ref("trend_keyword", kw.id))

    # Step 3: Extract high-frequency words from competitor titles
    competitor_words = []
    if category and market:
        result = await db.execute(
            select(TrendingProduct).where(
                TrendingProduct.user_id == user_id,
                TrendingProduct.category_path == category,
                TrendingProduct.market == market,
            ).limit(20)
        )
        for p in result.scalars().all():
            words = (p.name or "").split()
            competitor_words.extend([w for w in words if len(w) > 2][:5])
            source_refs.append(source_ref("trending_product", p.id))

    # Step 4-5: Build candidate titles (platform-aware)
    titles = _build_titles(
        product_name, attr_words, trend_words, competitor_words, rule
    )

    return {
        "titles": titles,
        "status": "ready",
        "platform": platform,
        "market": market,
        "rules": rule,
        "keywords": {
            "attribute_words": list(set(attr_words)),
            "trend_words": trend_words,
            "competitor_words": list(set(competitor_words))[:10],
        },
        **evidence_payload(
            source_refs=unique_refs(source_refs),
            evidence_window="当前请求输入与数据库最新趋势/热卖商品快照",
            confidence_reason=(
                f"使用 {len(trend_words)} 个趋势词和 {len(set(competitor_words))} 个热卖商品词生成；"
                "标题仍需通过真实曝光和转化数据验证"
            ),
            data_gaps=[],
        ),
    }


def _build_titles(
    product_name: str,
    attr_words: list[str],
    trend_words: list[str],
    competitor_words: list[str],
    rule: dict,
) -> list[str]:
    """Build platform-optimized titles."""
    max_chars = rule["max_chars"]
    unique_attrs = list(dict.fromkeys(attr_words))  # dedup, preserve order

    # Select top trend words
    top_trends = trend_words[:3] if trend_words else []
    top_competitor_words = list(dict.fromkeys(competitor_words))[:3] if competitor_words else []

    candidates = []

    # Variation 1: Core + Attributes + Trend
    parts = [product_name]
    if top_trends:
        parts.extend(top_trends[:2])
    extra = [w for w in unique_attrs if w != product_name][:4]
    parts.extend(extra)
    t1 = " ".join(parts)
    if len(t1) > max_chars:
        t1 = t1[:max_chars].rsplit(" ", 1)[0]
    candidates.append(t1)

    # Variation 2: Trend words front-loaded
    if top_trends:
        parts2 = top_trends[:2] + [product_name]
        extra2 = [w for w in unique_attrs if w not in parts2][:3]
        parts2.extend(extra2)
        t2 = " ".join(parts2)
        if len(t2) > max_chars:
            t2 = t2[:max_chars].rsplit(" ", 1)[0]
        candidates.append(t2)

    # Variation 3: Short title
    short_parts = [product_name]
    if top_trends:
        short_parts.append(top_trends[0])
    t3 = " ".join(short_parts[:2])
    candidates.append(t3[:max_chars])

    # Variation 4: Feature-rich
    feat_parts = [product_name]
    for w in unique_attrs[:6]:
        if w not in feat_parts:
            feat_parts.append(w)
    t4 = " ".join(feat_parts)
    if len(t4) > max_chars:
        t4 = t4[:max_chars].rsplit(" ", 1)[0]
    candidates.append(t4)

    # Variation 5: Market-tailored
    if top_competitor_words:
        market_parts = [product_name] + top_competitor_words
        t5 = " ".join(market_parts[:5])
        if len(t5) > max_chars:
            t5 = t5[:max_chars].rsplit(" ", 1)[0]
        candidates.append(t5)

    return candidates[:5]

"""Projection helpers for product recommendation UI context."""

from typing import Any, Optional


BUSINESS_EVIDENCE_LABELS = {
    "trend": "趋势",
    "platform": "平台",
    "supply": "供应",
    "profit": "利润",
    "competitor": "竞品",
}


def enrich_recommendation_product_context(recommendation: dict[str, Any]) -> dict[str, Any]:
    """Attach product context and reusable seller experience notes."""
    next_item = dict(recommendation)
    next_item["product_context"] = _product_context(recommendation)
    next_item["experience_notes"] = _experience_notes(recommendation)
    return next_item


def _product_context(recommendation: dict[str, Any]) -> dict[str, Any]:
    return {
        "category": recommendation.get("category"),
        "platform": recommendation.get("target_platform"),
        "market": recommendation.get("target_market"),
        "trend": {
            "search_volume": recommendation.get("search_volume"),
            "trend_direction": recommendation.get("trend_direction"),
            "seasonal": bool(recommendation.get("seasonal")),
            "keywords": recommendation.get("keywords") or [],
        },
        "pricing": {
            "avg_price_local": recommendation.get("avg_price_local"),
            "avg_price_rmb_equivalent": recommendation.get("avg_price_rmb_equivalent"),
            "suggested_sourcing_price_rmb": recommendation.get("suggested_sourcing_price_rmb"),
            "suggested_selling_price_local": recommendation.get("suggested_selling_price_local"),
        },
        "evidence": {
            "source_ref_count": len(recommendation.get("source_refs") or []),
            "evidence_window": recommendation.get("evidence_window"),
        },
        "media": {
            "image_url": recommendation.get("image_url"),
            "image_count": recommendation.get("image_count") or 0,
            "source_url": recommendation.get("source_url"),
            "source_label": recommendation.get("source_label"),
        },
    }


def _experience_notes(recommendation: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {"type": "market", "title": "市场经验", "content": _market_note(recommendation)},
        {"type": "pricing", "title": "价格经验", "content": _pricing_note(recommendation)},
        {"type": "content", "title": "内容经验", "content": _content_note(recommendation)},
        {"type": "risk", "title": "风险经验", "content": _risk_note(recommendation)},
    ]


def _market_note(recommendation: dict[str, Any]) -> str:
    evidence = recommendation.get("evidence_completeness") or {}
    present_labels = [
        label for key, label in BUSINESS_EVIDENCE_LABELS.items()
        if evidence.get(key) == "present"
    ]
    scope = f"{recommendation.get('target_market')} / {recommendation.get('target_platform')}"
    if present_labels:
        return f"{scope} 已有{'、'.join(present_labels)}资料，可进入精细化验证。"
    return f"{scope} 仍缺少核心资料，先补趋势、平台、供应和竞品数据。"


def _pricing_note(recommendation: dict[str, Any]) -> str:
    avg_price = _format_value(recommendation.get("avg_price_local"))
    suggested_price = _format_value(recommendation.get("suggested_selling_price_local"))
    sourcing_price = recommendation.get("suggested_sourcing_price_rmb") or "暂无采购价"
    if avg_price and suggested_price:
        return f"竞品均价 {avg_price}，建议售价 {suggested_price}，1688 采购参考 {sourcing_price}。"
    if avg_price:
        return f"竞品均价 {avg_price}，仍需结合采购价和目标利润复核售价。"
    return f"暂无竞品均价，1688 采购参考 {sourcing_price}，定价前需补平台价格资料。"


def _content_note(recommendation: dict[str, Any]) -> str:
    gaps = recommendation.get("listing_tips") or []
    if gaps:
        return f"Listing 制作前需补：{'、'.join(gaps)}。"
    keyword_text = "、".join((recommendation.get("keywords") or [])[:3]) or recommendation.get("product_name")
    return f"暂无内容缺口，Listing 可围绕 {keyword_text} 展开标题、图片和短视频脚本。"


def _risk_note(recommendation: dict[str, Any]) -> str:
    summary = recommendation.get("evidence_summary") or {}
    present = summary.get("present", 0)
    total = summary.get("total", 0)
    gaps = recommendation.get("data_gaps") or recommendation.get("listing_tips") or []
    if gaps:
        return f"资料完整度 {present}/{total}，当前待补：{'、'.join(gaps)}。"
    return f"资料完整度 {present}/{total}，仍需在刊登前复核缺失或低置信字段。"


def _format_value(value: Optional[float]) -> Optional[str]:
    if value is None:
        return None
    numeric = float(value)
    if numeric.is_integer():
        return str(int(numeric))
    return f"{numeric:.2f}".rstrip("0").rstrip(".")

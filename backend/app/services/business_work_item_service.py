"""Unified work-item state helpers for product lifecycle projections."""

from typing import Literal


LifecycleStatus = Literal[
    "signal_captured",
    "candidate_validating",
    "decision_pending",
    "decision_passed",
    "content_required",
    "content_ready",
    "pricing_required",
    "price_confirmed",
    "listing_ready",
    "draft_created",
    "published",
    "blocked",
    "archived",
]

EvidenceStatus = Literal["present", "missing", "stale", "low_confidence"]

EVIDENCE_CATEGORIES = (
    "trend",
    "social",
    "platform",
    "supply",
    "profit",
    "competitor",
    "content",
    "risk",
)

LIFECYCLE_LABELS: dict[str, str] = {
    "signal_captured": "已捕获信号",
    "candidate_validating": "候选验证中",
    "decision_pending": "待选品决策",
    "decision_passed": "选品已通过",
    "content_required": "待内容制作",
    "content_ready": "内容已完成",
    "pricing_required": "待定价校验",
    "price_confirmed": "价格已确认",
    "listing_ready": "待平台刊登",
    "draft_created": "已生成草稿",
    "published": "已发布/回写",
    "blocked": "流程阻塞",
    "archived": "已归档",
}


def enrich_work_item_state(item: dict) -> dict:
    """Attach the unified object state contract to a business-flow item."""
    lifecycle_status = _lifecycle_status(item)
    evidence = _evidence_completeness(item)
    next_item = dict(item)
    next_item.update({
        "work_item_id": f"{item['type']}:{item['id']}",
        "object_refs": [{"type": item["type"], "id": item["id"], "label": item["name"]}],
        "lifecycle_status": lifecycle_status,
        "lifecycle_label": LIFECYCLE_LABELS[lifecycle_status],
        "evidence_completeness": evidence,
        "evidence_summary": _evidence_summary(evidence),
    })
    return next_item


def enrich_recommendation_work_state(
    recommendation: dict,
    source_type: str,
    source_id: str,
    source_name: str,
) -> dict:
    """Attach the unified object state contract to a product recommendation."""
    work_item = enrich_work_item_state({
        "id": source_id,
        "type": source_type,
        "name": source_name,
        "stage_key": "selection",
        "status": "data_required" if recommendation.get("listing_tips") else "ready",
        "gaps": recommendation.get("listing_tips") or [],
        "data_gaps": recommendation.get("listing_tips") or [],
        "source_refs": recommendation.get("source_refs") or [],
        "platform": recommendation.get("target_platform"),
        "market": recommendation.get("target_market"),
        "signal": recommendation.get("confidence_reason"),
    })
    return {
        **recommendation,
        "work_item_id": work_item["work_item_id"],
        "object_refs": work_item["object_refs"],
        "lifecycle_status": work_item["lifecycle_status"],
        "lifecycle_label": work_item["lifecycle_label"],
        "evidence_completeness": work_item["evidence_completeness"],
        "evidence_summary": work_item["evidence_summary"],
    }


def _lifecycle_status(item: dict) -> str:
    item_type = item["type"]
    stage_key = item["stage_key"]
    gaps = item.get("gaps") or item.get("data_gaps") or []
    joined_gaps = " ".join(gaps)

    if item_type == "product_discovery":
        if "缺少选品决策" in joined_gaps:
            return "decision_pending"
        return "candidate_validating" if gaps else "decision_passed"

    if stage_key == "selection":
        return "candidate_validating" if gaps else "decision_passed"
    if stage_key == "sourcing":
        if any(token in joined_gaps for token in ("采购价", "货源链接", "1688 价格", "1688 商品链接")):
            return "decision_passed"
        return "content_required"
    if stage_key == "content":
        return "content_required" if gaps else "content_ready"
    if stage_key == "pricing":
        return "price_confirmed" if item.get("status") == "price_confirmed" else "pricing_required"
    if stage_key == "listing":
        if item_type == "platform_listing":
            status_text = item.get("signal") or ""
            if "active" in status_text and not gaps:
                return "published"
            return "draft_created"
        return "listing_ready"
    if stage_key == "fulfillment":
        return "published" if not gaps else "blocked"
    if stage_key == "optimization":
        return "published" if not gaps else "blocked"
    return "blocked" if item.get("status") == "blocked" else "signal_captured"


def _evidence_completeness(item: dict) -> dict[str, EvidenceStatus]:
    item_type = item["type"]
    stage_key = item["stage_key"]
    gaps = item.get("gaps") or item.get("data_gaps") or []
    joined_gaps = " ".join(gaps)
    evidence: dict[str, EvidenceStatus] = {category: "missing" for category in EVIDENCE_CATEGORIES}

    if item.get("source_refs"):
        evidence["risk"] = "present"

    if item_type == "product_discovery":
        evidence["trend"] = "missing" if "趋势评分" in joined_gaps else "present"
        evidence["supply"] = "missing" if "采购价" in joined_gaps else "present"
        evidence["profit"] = "missing" if "采购价" in joined_gaps else "present"
    elif item_type in ("sourcing_item", "supply_product", "trending_product"):
        evidence["trend"] = "missing" if "趋势" in joined_gaps else "present"
        evidence["supply"] = "missing" if any(token in joined_gaps for token in ("采购价", "货源链接", "1688 价格", "1688 商品链接")) else "present"
        evidence["profit"] = "missing" if "采购价" in joined_gaps or "1688 价格" in joined_gaps else "present"
        evidence["platform"] = "present" if item.get("platform") else "missing"
        evidence["competitor"] = "missing" if "竞品" in joined_gaps else "present"
        if stage_key in ("pricing", "listing") and not any(
            token in joined_gaps for token in ("内容", "标题", "卖点", "描述", "图片", "视频", "合规")
        ):
            evidence["content"] = "present"
    elif item_type == "platform_listing":
        evidence["platform"] = "present"
        evidence["content"] = "missing" if "图片" in joined_gaps else "present"
        evidence["profit"] = "present" if item.get("signal") else "missing"
    elif item_type == "order":
        evidence["platform"] = "present"
        evidence["profit"] = "present" if item.get("signal") else "missing"
    elif item_type == "ai_suggestion":
        evidence["risk"] = "low_confidence" if "置信度" in joined_gaps else "present"

    if stage_key in ("content", "listing", "fulfillment", "optimization") and evidence["content"] == "missing":
        evidence["content"] = "missing"
    if item.get("market") and evidence["platform"] == "missing":
        evidence["platform"] = "low_confidence"
    if "竞品" in joined_gaps:
        evidence["competitor"] = "missing"
    return evidence


def _evidence_summary(evidence: dict[str, EvidenceStatus]) -> dict[str, int]:
    return {
        "total": len(evidence),
        "present": sum(1 for value in evidence.values() if value == "present"),
        "missing": sum(1 for value in evidence.values() if value == "missing"),
        "stale": sum(1 for value in evidence.values() if value == "stale"),
        "low_confidence": sum(1 for value in evidence.values() if value == "low_confidence"),
    }

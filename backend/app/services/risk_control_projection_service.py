"""Projection helpers for the V2 risk-control workspace."""


def build_risk_control_projections(risks: list[dict], categories: list[dict]) -> dict:
    active = [item for item in risks if item["status"] not in ("closed", "ignored")]
    return {
        "risk_radar": _risk_radar(categories, risks, active),
        "risk_heatmap": _risk_heatmap(categories, risks),
        "ai_recommendations": _ai_recommendations(active),
        "review_records": _review_records(risks),
    }


def _risk_radar(categories: list[dict], risks: list[dict], active: list[dict]) -> list[dict]:
    rows = []
    for category in categories:
        key = category["key"]
        active_items = [item for item in active if item["type"] == key]
        all_items = [item for item in risks if item["type"] == key]
        critical = sum(1 for item in active_items if item["severity"] == "critical")
        warning = sum(1 for item in active_items if item["severity"] == "warning")
        overdue = sum(1 for item in active_items if item["is_overdue"])
        score = critical * 40 + warning * 20 + overdue * 30 + len(category.get("data_gaps", [])) * 10
        rows.append({
            "key": key,
            "label": category["label"],
            "route": category["route"],
            "active_count": len(active_items),
            "critical": critical,
            "warning": warning,
            "overdue": overdue,
            "closed": sum(1 for item in all_items if item["status"] in ("closed", "ignored")),
            "score": min(score, 100),
            "status": category["status"],
            "data_gaps": category.get("data_gaps", []),
        })
    return rows


def _risk_heatmap(categories: list[dict], risks: list[dict]) -> list[dict]:
    rows = []
    for category in categories:
        items = [item for item in risks if item["type"] == category["key"]]
        critical = sum(1 for item in items if item["severity"] == "critical" and item["status"] not in ("closed", "ignored"))
        warning = sum(1 for item in items if item["severity"] == "warning" and item["status"] not in ("closed", "ignored"))
        processing = sum(1 for item in items if item["status"] == "processing")
        closed = sum(1 for item in items if item["status"] in ("closed", "ignored"))
        rows.append({
            "category": category["key"],
            "label": category["label"],
            "route": category["route"],
            "critical": critical,
            "warning": warning,
            "processing": processing,
            "closed": closed,
            "total": len(items),
            "heat_level": _heat_level(critical, warning, processing, category.get("data_gaps", [])),
        })
    return rows


def _ai_recommendations(active: list[dict]) -> list[dict]:
    return [{
        "risk_id": item["id"],
        "title": item["title"],
        "type": item["type"],
        "severity": item["severity"],
        "recommendation": _recommendation(item),
        "route": item["route"],
        "source_refs": item["source_refs"],
        "status": "suggested",
        "does_not_change_state": True,
    } for item in active[:8]]


def _review_records(risks: list[dict]) -> list[dict]:
    closed = [item for item in risks if item["status"] in ("closed", "ignored")]
    return [{
        "risk_id": item["id"],
        "title": item["title"],
        "type": item["type"],
        "type_label": item.get("type_label"),
        "outcome": "已忽略" if item["status"] == "ignored" else "已关闭",
        "closed_at": item.get("closed_at"),
        "note": item.get("note"),
        "route": item["route"],
        "source_refs": item["source_refs"],
    } for item in closed[:10]]


def _recommendation(risk: dict) -> str:
    if risk["type"] == "inventory":
        return "复核安全库存、在途补货和近 7 天销量，必要时创建补货计划。"
    if risk["type"] == "currency":
        return "复核汇率、平台费和利润台账，确认是否需要调整售价。"
    if risk["type"] == "logistics":
        return "进入订单履约核对发货、物流轨迹和售后风险。"
    if risk["type"] == "compliance":
        return "人工核验来源证据，确认是否存在平台规则、IP 或竞品异常。"
    if risk["type"] == "business":
        return "复核店铺投入、选品、Listing、定价和投放策略，必要时暂停继续投入并转入经营复盘。"
    if risk["type"] == "account":
        return "复核平台店铺授权、同步状态和凭证有效期。"
    return "人工复核风险来源与处理动作。"


def _heat_level(critical: int, warning: int, processing: int, data_gaps: list[str]) -> str:
    if critical:
        return "critical"
    if warning or processing:
        return "warning"
    if data_gaps:
        return "data_required"
    return "clear"

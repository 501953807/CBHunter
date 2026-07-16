"""Risk-control platform/store/market location gap aggregation."""


def _risk_location_gap_queue(risks: list[dict]) -> list[dict]:
    definitions = [
        ("platform", "平台归属待定位", "补齐平台归属", "/platforms"),
        ("store", "店铺归属待定位", "补齐店铺归属", "/platforms"),
        ("market", "目标市场待定位", "补齐目标市场", "/settings/dicts"),
    ]
    buckets = {
        key: {
            "gap_key": key,
            "label": label,
            "action_label": action_label,
            "route": route,
            "risk_count": 0,
            "critical": 0,
            "warning": 0,
            "sample_risks": [],
        }
        for key, label, action_label, route in definitions
    }
    for risk in risks:
        keys = []
        if _is_unlocated_platform(risk.get("platform")):
            keys.append("platform")
        elif _is_unlocated_store(risk):
            keys.append("store")
        elif _is_unlocated_market(risk.get("market")):
            keys.append("market")
        for key in keys:
            row = buckets[key]
            row["risk_count"] += 1
            if risk.get("severity") == "critical":
                row["critical"] += 1
            elif risk.get("severity") == "warning":
                row["warning"] += 1
            if len(row["sample_risks"]) < 3:
                row["sample_risks"].append({
                    "id": risk.get("id"),
                    "title": risk.get("title"),
                    "type": risk.get("type"),
                    "severity": risk.get("severity"),
                    "route": risk.get("route"),
                })
    return [buckets[key] for key, *_ in definitions if buckets[key]["risk_count"] > 0]


def _is_unlocated_platform(value: str | None) -> bool:
    return not value or value in {"待定位平台", "平台待定位"} or str(value).lower() == "unknown"


def _is_unlocated_store(risk: dict) -> bool:
    account_name = risk.get("account_name")
    return not risk.get("platform_account_id") or not account_name or account_name in {"待定位店铺", "店铺待定位"}


def _is_unlocated_market(value: str | None) -> bool:
    return not value or value in {"市场待补", "待定位市场", "市场待定位"} or str(value).lower() == "unknown"

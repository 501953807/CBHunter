"""Risk-control categories and comparison helpers."""


RISK_CATEGORY_LIBRARY = [
    {"key": "account", "label": "账号安全风险", "route": "/platforms", "description": "平台授权、凭证、店铺可用性和同步阻断。"},
    {"key": "business", "label": "店铺经营风险", "route": "/command-center", "description": "店铺投入、销售下滑、长期无销售和经营效率异常。"},
    {"key": "compliance", "label": "合规/IP 风险", "route": "/monitor", "description": "侵权、禁限售、投诉和竞品异常信号。"},
    {"key": "logistics", "label": "物流时效风险", "route": "/orders", "description": "订单履约超时、物流异常和发货阻塞。"},
    {"key": "currency", "label": "汇率与利润风险", "route": "/settings/fees", "description": "市场币种、汇率缺口、利润台账矛盾。"},
    {"key": "inventory", "label": "库存/供货风险", "route": "/inventory-alerts", "description": "库存预警、可售库存未知和补货断点。"},
]


def risk_snapshot(risks: list[dict]) -> dict:
    active = [item for item in risks if item["status"] not in ("closed", "ignored")]
    return {
        "active": len(active),
        "critical": sum(1 for item in active if item["severity"] == "critical"),
        "warning": sum(1 for item in active if item["severity"] == "warning"),
        "events": len(risks),
    }


def change_pct(current, baseline):
    if current is None or baseline in (None, 0):
        return None
    return round(((current - baseline) / abs(baseline)) * 100, 2)

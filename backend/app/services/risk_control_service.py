"""Risk-control projection built from traceable cockpit sections."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.risk_event_state import RiskEventState
from app.models.user import User
from app.schemas.risk_control import RiskStateUpdateRequest
from app.services.audit_service import record_audit_event
from app.services.cockpit_service import get_operating_cockpit
from app.services.risk_control_projection_service import build_risk_control_projections

RISK_CATEGORY_LIBRARY = [
    {"key": "account", "label": "账号安全风险", "route": "/platforms", "description": "平台授权、凭证、店铺可用性和同步阻断。"},
    {"key": "compliance", "label": "合规/IP 风险", "route": "/monitor", "description": "侵权、禁限售、投诉和竞品异常信号。"},
    {"key": "logistics", "label": "物流时效风险", "route": "/orders", "description": "订单履约超时、物流异常和发货阻塞。"},
    {"key": "currency", "label": "汇率与利润风险", "route": "/settings/fees", "description": "市场币种、汇率缺口、利润台账矛盾。"},
    {"key": "inventory", "label": "库存/供货风险", "route": "/inventory-alerts", "description": "库存预警、可售库存未知和补货断点。"},
]


async def get_risk_control_overview(db: AsyncSession, user_id: str) -> dict:
    cockpit = await get_operating_cockpit(db, user_id)
    risks = _build_risks(cockpit)
    states = await _load_states(db, user_id, [item["id"] for item in risks])
    risks = [_merge_state(item, states.get(item["id"])) for item in risks]
    active_risks = [item for item in risks if item["status"] not in ("closed", "ignored")]
    gaps = _risk_gaps(cockpit, active_risks)
    assessment_status = "attention" if active_risks else "insufficient" if gaps else "clear"
    risk_categories = _risk_categories(cockpit, active_risks)
    projections = build_risk_control_projections(risks, risk_categories)
    return {
        "generated_at": cockpit["generated_at"],
        "assessment_status": assessment_status,
        "metrics": {
            "pending": sum(1 for item in risks if item["status"] == "pending"),
            "processing": sum(1 for item in risks if item["status"] == "processing"),
            "closed": sum(1 for item in risks if item["status"] in ("closed", "ignored")),
            "overdue": sum(1 for item in active_risks if item["is_overdue"]),
            "critical": sum(1 for item in active_risks if item["severity"] == "critical"),
            "warning": sum(1 for item in active_risks if item["severity"] == "warning"),
            "source_count": sum(len(item["source_refs"]) for item in risks),
            "category_count": len(RISK_CATEGORY_LIBRARY),
        },
        "risks": risks,
        "risk_categories": risk_categories,
        **projections,
        "source_refs": _unique_refs([ref for item in risks for ref in item["source_refs"]]),
        "evidence_window": cockpit["evidence_window"],
        "confidence_reason": "风险管控由经营指挥台中的库存预警、报表异常、关键 AI 建议和竞品变化生成。",
        "data_gaps": gaps,
        "gaps": gaps,
        "gap_actions": _gap_actions(cockpit),
    }


async def update_risk_event_state(
    db: AsyncSession,
    current_user: User,
    risk_id: str,
    request: RiskStateUpdateRequest,
) -> dict:
    cockpit = await get_operating_cockpit(db, current_user.id)
    risk = next((item for item in _build_risks(cockpit) if item["id"] == risk_id), None)
    if not risk:
        raise ValueError("risk_not_found")

    result = await db.execute(
        select(RiskEventState).where(
            RiskEventState.user_id == current_user.id,
            RiskEventState.risk_id == risk_id,
        )
    )
    state = result.scalar_one_or_none()
    old_value = _state_snapshot(state)
    now = datetime.now(timezone.utc)
    if not state:
        state = RiskEventState(user_id=current_user.id, risk_id=risk_id)
        db.add(state)

    state.risk_type = risk["type"]
    state.title = risk["title"]
    state.severity = risk["severity"]
    state.status = request.status
    state.assigned_to = request.assigned_to or (current_user.username if request.status == "processing" else state.assigned_to)
    state.due_at = request.due_at
    state.note = request.note
    state.last_detail = risk["detail"]
    state.route = risk["route"]
    state.evidence_window = risk["evidence_window"]
    state.source_refs = risk["source_refs"]
    state.closed_at = now if request.status in ("closed", "ignored") else None
    state.updated_at = now

    await db.commit()
    await db.refresh(state)

    await record_audit_event(
        db,
        user=current_user,
        action=f"risk_{request.status}",
        resource_type="risk_event",
        resource_id=risk_id,
        old_value=old_value,
        new_value=_state_snapshot(state),
        detail=request.note,
    )
    return _merge_state(risk, state)


async def get_risk_event_audit(db: AsyncSession, user_id: str, risk_id: str) -> list[dict]:
    result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.user_id == user_id,
            AuditLog.resource_type == "risk_event",
            AuditLog.resource_id == risk_id,
        )
        .order_by(desc(AuditLog.created_at))
        .limit(50)
    )
    items = result.scalars().all()
    return [
        {
            "id": item.id,
            "action": item.action,
            "resource_id": item.resource_id,
            "old_value": item.old_value,
            "new_value": item.new_value,
            "detail": item.detail,
            "created_at": item.created_at,
        }
        for item in items
    ]


def _build_risks(cockpit: dict) -> list[dict]:
    sections = cockpit["sections"]
    risks = []
    for item in sections["alerts"]["items"]:
        risks.append({
            "id": f"inventory:{item['id']}",
            "type": "inventory",
            "type_label": "库存/供货风险",
            "title": item["product_name"],
            "severity": "critical" if item["severity"] == "critical" else "warning",
            "status": "pending",
            "detail": f"当前库存 {item['current_stock']}，阈值 {item['threshold']}",
            "route": "/inventory-alerts",
            "evidence_window": sections["alerts"]["evidence_window"],
            "source_refs": [
                ref for ref in sections["alerts"]["source_refs"] if ref.get("id") == item["id"]
            ],
            "data_gaps": [],
        })
    for item in sections["reports"]["items"]:
        risks.append({
            "id": f"report:{item['metric']}",
            "type": "currency",
            "type_label": "汇率与利润风险",
            "title": item["metric"],
            "severity": "warning",
            "status": "pending",
            "detail": f"实际 {item['actual']}，预期 {item['expected']}，偏差 {item['deviation_pct']}%",
            "route": "/reports",
            "evidence_window": sections["reports"]["evidence_window"],
            "source_refs": sections["reports"]["source_refs"],
            "data_gaps": sections["reports"]["data_gaps"],
        })
    for item in sections["ai_suggestions"]["items"]:
        if item["severity"] != "critical":
            continue
        risks.append({
            "id": f"ai:{item['id']}",
            "type": "compliance",
            "type_label": "合规/IP 风险",
            "title": item["title"],
            "severity": "critical",
            "status": "pending",
            "detail": item["confidence_reason"] or "AI 建议要求人工复核",
            "route": "/ai-suggestions",
            "evidence_window": item["evidence_window"] or sections["ai_suggestions"]["evidence_window"],
            "source_refs": item["source_refs"] or [],
            "data_gaps": [],
        })
    if sections["competitors"]["metrics"]["price_changes_detected"] > 0:
        risks.append({
            "id": "competitor:price-change",
            "type": "compliance",
            "type_label": "合规/IP 风险",
            "title": "竞品价格变化",
            "severity": "warning",
            "status": "pending",
            "detail": f"{sections['competitors']['metrics']['price_changes_detected']} 条竞品价格变化待复核",
            "route": "/monitor",
            "evidence_window": sections["competitors"]["evidence_window"],
            "source_refs": sections["competitors"]["source_refs"],
            "data_gaps": sections["competitors"]["data_gaps"],
        })
    for item in sections["orders"]["items"]:
        exception = item.get("fulfillment_exception") or {}
        exception_status = exception.get("status")
        if exception_status and exception_status != "clear":
            risks.append({
                "id": f"logistics:{item['id']}",
                "type": "logistics",
                "type_label": "物流时效风险",
                "title": f"订单 {item['order_number']} 履约异常",
                "severity": "critical" if exception.get("severity") == "critical" else "warning",
                "status": "pending",
                "detail": "；".join(exception.get("reasons") or ["履约异常待复核"]),
                "route": exception.get("route") or "/orders?exceptions=1",
                "evidence_window": sections["orders"]["evidence_window"],
                "source_refs": [ref for ref in sections["orders"]["source_refs"] if ref.get("id") == item["id"]],
                "data_gaps": exception.get("data_gaps") or [],
            })
            continue
        if item["status"] not in ("pending", "processing"):
            continue
        ordered_at = _parse_dt(item.get("ordered_at"))
        if not ordered_at or datetime.now(timezone.utc) - ordered_at < _days(3):
            continue
        risks.append({
            "id": f"logistics:{item['id']}",
            "type": "logistics",
            "type_label": "物流时效风险",
            "title": f"订单 {item['order_number']} 履约超时",
            "severity": "warning",
            "status": "pending",
            "detail": f"订单状态仍为 {item['status']}，下单已超过 3 天，请复核发货与物流轨迹",
            "route": "/orders",
            "evidence_window": sections["orders"]["evidence_window"],
            "source_refs": [ref for ref in sections["orders"]["source_refs"] if ref.get("id") == item["id"]],
            "data_gaps": [],
        })
    return risks


def _risk_categories(cockpit: dict, active_risks: list[dict]) -> list[dict]:
    counts = {item["key"]: 0 for item in RISK_CATEGORY_LIBRARY}
    for risk in active_risks:
        counts[risk["type"]] = counts.get(risk["type"], 0) + 1
    gaps_by_type = {
        "account": [] if cockpit["active_filters"].get("store_count", 0) else ["platform_accounts"],
        "compliance": cockpit["sections"]["competitors"]["data_gaps"],
        "logistics": cockpit["sections"]["orders"]["data_gaps"],
        "currency": cockpit["sections"]["finance"]["data_gaps"],
        "inventory": cockpit["sections"]["inventory"]["data_gaps"] + cockpit["sections"]["alerts"]["data_gaps"],
    }
    return [
        {
            **category,
            "active_count": counts.get(category["key"], 0),
            "status": "attention" if counts.get(category["key"], 0) else "data_required" if gaps_by_type.get(category["key"]) else "clear",
            "data_gaps": gaps_by_type.get(category["key"], []),
        }
        for category in RISK_CATEGORY_LIBRARY
    ]


def _risk_gaps(cockpit: dict, risks: list[dict]) -> list[str]:
    gaps = []
    for key in ("alerts", "reports", "competitors", "finance"):
        gaps.extend(cockpit["sections"][key]["gaps"])
    return list(dict.fromkeys(gaps))


def _gap_actions(cockpit: dict) -> list[dict]:
    config = {
        "alerts": ("库存风险覆盖", "高", "/inventory-alerts"),
        "reports": ("经营报表覆盖", "高", "/reports"),
        "competitors": ("竞品风险信号", "中", "/monitor"),
        "finance": ("财务利润缺口", "高", "/finance"),
    }
    actions = []
    for key, (category, priority, route) in config.items():
        for gap in cockpit["sections"][key]["gaps"]:
            target_route = _gap_action_route(key, gap, route)
            actions.append({"category": category, "priority": priority, "detail": gap, "route": target_route, "action_label": _gap_action_label(key, gap)})
    return actions


def _gap_action_route(key: str, gap: str, default_route: str) -> str:
    if key == "finance" and any(token in gap for token in ("平台账单", "平台费", "交易费", "服务费", "税费", "退款")):
        return "/finance?entry_type=platform_fee#finance-ledger"
    if key == "finance" and "收入" in gap:
        return "/finance?entry_type=sales_income#finance-ledger"
    if key == "finance" and any(token in gap for token in ("成本", "物流费")):
        return "/finance?entry_type=purchase_cost#finance-ledger"
    return default_route


def _gap_action_label(key: str, gap: str) -> str:
    if key == "alerts":
        return "前往库存预警处理"
    if key == "reports":
        return "前往报表中心复核"
    if key == "competitors":
        return "前往竞品监控补齐"
    if key == "finance" and any(token in gap for token in ("平台账单", "平台费", "交易费", "服务费", "税费", "退款")):
        return "补录平台账单"
    if key == "finance":
        return "前往财务台账补齐"
    return "前往处理"


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _days(value: int):
    from datetime import timedelta
    return timedelta(days=value)


def _unique_refs(refs: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for ref in refs:
        key = (ref.get("type"), ref.get("id"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(ref)
    return unique


async def _load_states(db: AsyncSession, user_id: str, risk_ids: list[str]) -> dict[str, RiskEventState]:
    if not risk_ids:
        return {}
    result = await db.execute(
        select(RiskEventState).where(
            RiskEventState.user_id == user_id,
            RiskEventState.risk_id.in_(risk_ids),
        )
    )
    return {item.risk_id: item for item in result.scalars().all()}


def _merge_state(risk: dict, state: Optional[RiskEventState]) -> dict:
    merged = dict(risk)
    if not state:
        merged.update({
            "assigned_to": None,
            "due_at": None,
            "is_overdue": False,
            "note": None,
            "closed_at": None,
            "updated_at": None,
        })
        return merged
    merged.update({
        "status": state.status,
        "assigned_to": state.assigned_to,
        "due_at": state.due_at,
        "is_overdue": _is_overdue(state),
        "note": state.note,
        "closed_at": state.closed_at,
        "updated_at": state.updated_at,
    })
    return merged


def _state_snapshot(state: Optional[RiskEventState]) -> Optional[dict]:
    if not state:
        return None
    return {
        "status": state.status,
        "assigned_to": state.assigned_to,
        "due_at": state.due_at.isoformat() if state.due_at else None,
        "note": state.note,
        "closed_at": state.closed_at.isoformat() if state.closed_at else None,
    }


def _is_overdue(state: RiskEventState) -> bool:
    if not state.due_at or state.status in ("closed", "ignored"):
        return False
    due_at = state.due_at
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)
    return due_at < datetime.now(timezone.utc)

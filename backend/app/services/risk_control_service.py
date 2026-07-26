"""Risk-control projection built from traceable cockpit sections."""

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.platform_listing import PlatformListing
from app.models.risk_event_state import RiskEventState
from app.models.user import User
from app.schemas.risk_control import RiskStateUpdateRequest
from app.services.audit_service import record_audit_event
from app.services.cockpit_service import get_operating_cockpit
from app.services.finance_service import get_finance_summary
from app.services.inventory_alert_service import get_inventory_risk_workbench
from app.services.order_service import get_order_stats
from app.services.risk_control_category_service import RISK_CATEGORY_LIBRARY, change_pct, risk_snapshot
from app.services.risk_control_location_service import _risk_location_gap_queue
from app.services.risk_control_projection_service import build_risk_control_projections
from app.services.risk_control_sales_risk_service import get_listing_sales_decline_risks
from app.services.risk_control_sla_service import RISK_SLA_TEMPLATES, get_risk_sla_templates
from app.services.risk_control_source_summary_service import build_risk_source_summary


async def get_risk_control_overview(db: AsyncSession, user_id: str, start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
    cockpit = await get_operating_cockpit(db, user_id, start_date=start_date, end_date=end_date)
    inventory_workbench = await get_inventory_risk_workbench(db, user_id)
    finance_summary = await get_finance_summary(db, user_id, "monthly")
    order_stats = await get_order_stats(db, user_id)
    sla_templates = await get_risk_sla_templates(db)
    risks = _build_risks(cockpit)
    risks.extend(_inventory_workbench_risks(inventory_workbench))
    risks.extend(_finance_signal_risks(finance_summary))
    risks.extend(await get_listing_sales_decline_risks(db, user_id))
    risks = await _attach_risk_scope(db, cockpit, risks)
    states = await _load_states(db, user_id, [item["id"] for item in risks])
    risks = [_merge_state(item, states.get(item["id"]), sla_templates) for item in risks]
    active_risks = [item for item in risks if item["status"] not in ("closed", "ignored")]
    gaps = _risk_gaps(cockpit, active_risks)
    assessment_status = "attention" if active_risks else "insufficient" if gaps else "clear"
    risk_categories = _risk_categories(cockpit, active_risks)
    projections = build_risk_control_projections(risks, risk_categories)
    comparison = await _risk_period_comparison(db, user_id, cockpit)
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
        "risk_sla_templates": sla_templates,
        "risks": risks,
        "risk_categories": risk_categories,
        "risk_store_matrix": _risk_store_matrix(active_risks),
        "risk_platform_matrix": _risk_platform_matrix(active_risks),
        "risk_source_summary": build_risk_source_summary(active_risks, inventory_workbench, finance_summary, order_stats),
        "location_gap_queue": _risk_location_gap_queue(active_risks),
        "comparison": comparison,
        **projections,
        "source_refs": _unique_refs([ref for item in risks for ref in item["source_refs"]]),
        "evidence_window": cockpit["evidence_window"],
        "confidence_reason": "风险管控由订单履约发货时限、库存预警与库存风险工作台、真实财务台账利润信号、经营指挥台和竞品变化生成。",
        "data_gaps": gaps,
        "gaps": gaps,
        "gap_actions": _gap_actions(cockpit),
    }


async def update_risk_event_state(db: AsyncSession, current_user: User, risk_id: str, request: RiskStateUpdateRequest) -> dict:
    cockpit = await get_operating_cockpit(db, current_user.id)
    inventory_workbench = await get_inventory_risk_workbench(db, current_user.id)
    finance_summary = await get_finance_summary(db, current_user.id, "monthly")
    sla_templates = await get_risk_sla_templates(db)
    risks = _build_risks(cockpit)
    risks.extend(_inventory_workbench_risks(inventory_workbench))
    risks.extend(_finance_signal_risks(finance_summary))
    risks.extend(await get_listing_sales_decline_risks(db, current_user.id))
    risk = next((item for item in risks if item["id"] == risk_id), None)
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
    return _merge_state(risk, state, sla_templates)


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
            "product_id": item.get("product_id"),
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
    risks.extend(_store_business_risks(sections["store_matrix"]))
    risks.extend(_listing_operation_business_risks(sections["product_operations"]))
    for item in sections["orders"]["items"]:
        exception = item.get("fulfillment_exception") or {}
        exception_status = exception.get("status")
        if exception_status and exception_status != "clear":
            response_deadline_at = exception.get("deadline_at") or None
            sla_hours, remaining_time_label = _deadline_snapshot(response_deadline_at)
            risks.append({
                "id": f"logistics:{item['id']}",
                "type": "logistics",
                "type_label": "物流时效风险",
                "title": f"订单 {item['order_number']} 履约异常",
                "platform": item.get("platform"),
                "platform_account_id": item.get("platform_account_id"),
                "account_name": item.get("account_name"),
                "severity": "critical" if exception.get("severity") == "critical" else "warning",
                "status": "pending",
                "detail": "；".join(exception.get("reasons") or ["履约异常待复核"]),
                "route": exception.get("route") or "/orders?exceptions=1",
                "evidence_window": sections["orders"]["evidence_window"],
                "source_refs": [ref for ref in sections["orders"]["source_refs"] if ref.get("id") == item["id"]],
                "data_gaps": exception.get("data_gaps") or [],
                "estimated_impact": _order_risk_impact(item),
                "response_deadline_at": response_deadline_at,
                "remaining_time_label": remaining_time_label,
                "sla_hours": sla_hours,
            })
            continue
        if item["status"] not in ("pending", "processing"):
            continue
        ordered_at = _parse_dt(item.get("ordered_at"))
        if not ordered_at or datetime.now(timezone.utc) - ordered_at < _days(3):
            continue
        response_deadline_at = (ordered_at + _days(3)).isoformat()
        sla_hours, remaining_time_label = _deadline_snapshot(response_deadline_at)
        risks.append({
            "id": f"logistics:{item['id']}",
            "type": "logistics",
            "type_label": "物流时效风险",
            "title": f"订单 {item['order_number']} 履约超时",
            "platform": item.get("platform"),
            "platform_account_id": item.get("platform_account_id"),
            "account_name": item.get("account_name"),
            "severity": "warning",
            "status": "pending",
            "detail": f"订单状态仍为 {item['status']}，下单已超过 3 天，请复核发货与物流轨迹",
            "route": "/orders",
            "evidence_window": sections["orders"]["evidence_window"],
            "source_refs": [ref for ref in sections["orders"]["source_refs"] if ref.get("id") == item["id"]],
            "data_gaps": [],
            "estimated_impact": _order_risk_impact(item),
            "response_deadline_at": response_deadline_at,
            "remaining_time_label": remaining_time_label,
            "sla_hours": sla_hours,
        })
    return risks


def _inventory_workbench_risks(workbench: dict) -> list[dict]:
    risks: list[dict] = []
    for item in workbench.get("slow_moving", {}).get("items") or []:
        listing_id = item.get("listing_id")
        if not listing_id:
            continue
        stock = item.get("stock") or 0
        views = item.get("views_30d") or 0
        orders = item.get("orders_30d") or 0
        capital = item.get("capital_rmb")
        if capital is None:
            continue
        deadline = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()
        sla_hours, remaining_time_label = _deadline_snapshot(deadline)
        risks.append({
            "id": f"inventory:slow-capital:{listing_id}",
            "type": "inventory",
            "type_label": "库存/供货风险",
            "title": f"{item.get('title') or item.get('sku') or 'Listing'} 滞销库存资金占用",
            "listing_id": listing_id,
            "product_id": item.get("product_id"),
            "platform": item.get("platform"),
            "platform_account_id": item.get("platform_account_id"),
            "account_name": item.get("account_name"),
            "market": item.get("market"),
            "severity": "warning",
            "status": "pending",
            "detail": f"库存资金占用 ¥{_plain_amount(capital)}，当前库存 {int(stock)} 件，近30天浏览 {int(views)}、订单 {int(orders)}，请复核清仓、主图、标题、定价和平台属性。",
            "route": item.get("route") or f"/growth?listing_id={listing_id}",
            "evidence_window": "当前库存风险工作台：已确认库存、商品成本和近30天 Listing 运营指标",
            "source_refs": [
                {"type": "platform_listing", "id": listing_id, "label": item.get("sku"), "fields": ["stock", "performance", "platform_data"]},
                {"type": "product", "id": item.get("product_id"), "label": item.get("sku"), "fields": ["cost_price"]},
            ],
            "data_gaps": [],
            "estimated_impact": f"近30天浏览 {int(views)}、订单 {int(orders)}，库存 {int(stock)} 件，库存资金占用 ¥{_plain_amount(capital)}，可能造成库存积压和资金占用。",
            "response_deadline_at": deadline,
            "remaining_time_label": remaining_time_label,
            "sla_hours": sla_hours,
        })
    return risks


def _finance_signal_risks(finance_summary: dict) -> list[dict]:
    risks: list[dict] = []
    source_refs = finance_summary.get("source_refs") or []
    evidence_window = finance_summary.get("evidence_window") or "当前真实财务台账范围"
    for signal in finance_summary.get("risk_signals") or []:
        code = signal.get("code")
        if not code:
            continue
        deadline = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()
        sla_hours, remaining_time_label = _deadline_snapshot(deadline)
        level = signal.get("level")
        risks.append({
            "id": f"finance:{code}",
            "type": "currency",
            "type_label": "汇率与利润风险",
            "title": signal.get("title") or "财务风险",
            "severity": "critical" if level == "high" else "warning",
            "status": "pending",
            "detail": signal.get("detail") or "财务台账风险待复核",
            "route": signal.get("action_route") or "/finance",
            "evidence_window": f"真实财务台账：{evidence_window}",
            "source_refs": source_refs,
            "data_gaps": finance_summary.get("data_gaps") or [],
            "estimated_impact": signal.get("detail") or "财务台账缺口会影响收入、成本、利润、现金和平台账单判断。",
            "response_deadline_at": deadline,
            "remaining_time_label": remaining_time_label,
            "sla_hours": sla_hours,
            "action_label": signal.get("action_label") or "复核财务台账",
            "finance_signal_code": code,
        })
    return risks


def _listing_operation_business_risks(product_operations: dict) -> list[dict]:
    risks = []
    refs = product_operations.get("source_refs") or []
    for item in product_operations.get("items") or []:
        listing_id = item.get("listing_id")
        views = item.get("views_30d")
        orders = item.get("orders_30d")
        stock = item.get("stock")
        if item.get("diagnostic_code") != "traffic_no_order":
            continue
        if not listing_id or not views or orders not in (0, 0.0) or not stock or stock <= 0:
            continue
        deadline = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()
        sla_hours, remaining_time_label = _deadline_snapshot(deadline)
        risks.append({
            "id": f"business:traffic-no-order:{listing_id}",
            "type": "business",
            "type_label": "店铺经营风险",
            "title": f"{item.get('title') or 'Listing'} 有流量无订单",
            "listing_id": listing_id,
            "severity": "warning",
            "status": "pending",
            "detail": f"近30天浏览 {int(views)}、订单 0、库存 {int(stock)} 件，请复核主图、标题、价格、评价和平台属性。",
            "route": f"/growth?listing_id={listing_id}",
            "evidence_window": product_operations.get("evidence_window") or "近30天商品运营指标",
            "source_refs": [ref for ref in refs if ref.get("id") == listing_id],
            "data_gaps": [],
            "estimated_impact": f"近30天浏览 {int(views)}、订单 0，库存 {int(stock)} 件，可能造成库存占用和 Listing/定价/主图失效。",
            "response_deadline_at": deadline,
            "remaining_time_label": remaining_time_label,
            "sla_hours": sla_hours,
        })
    return risks


def _store_business_risks(store_matrix: dict) -> list[dict]:
    risks = []
    refs = store_matrix.get("source_refs") or []
    for store in store_matrix.get("items") or []:
        cost = store.get("cost_rmb")
        revenue = store.get("revenue_rmb")
        order_count = store.get("order_count") or 0
        if not cost or cost < 100 or revenue or order_count:
            continue
        deadline = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()
        sla_hours, remaining_time_label = _deadline_snapshot(deadline)
        account_id = store.get("id")
        risks.append({
            "id": f"business:spend-no-sales:{account_id}",
            "type": "business",
            "type_label": "店铺经营风险",
            "title": f"{store.get('account_name') or '店铺'} 投入未转化",
            "platform": store.get("platform"),
            "platform_account_id": account_id,
            "account_name": store.get("account_name"),
            "market": store.get("market"),
            "severity": "warning",
            "status": "pending",
            "detail": f"当前筛选日期范围内店铺已记录成本投入 ¥{_plain_amount(cost)}，但没有平台订单或销售收入，请复核选品、Listing、投放和定价。",
            "route": f"/finance?platform_account_id={account_id}#finance-ledger",
            "evidence_window": store_matrix.get("evidence_window") or "当前店铺经营日期区间待补",
            "source_refs": [ref for ref in refs if ref.get("id") == account_id],
            "data_gaps": [],
            "estimated_impact": f"店铺已投入 ¥{_plain_amount(cost)}，但当前筛选日期范围没有订单或收入，可能造成资金占用和选品/投放策略失效。",
            "response_deadline_at": deadline,
            "remaining_time_label": remaining_time_label,
            "sla_hours": sla_hours,
        })
    return risks


async def _attach_risk_scope(db: AsyncSession, cockpit: dict, risks: list[dict]) -> list[dict]:
    store_lookup = {
        item["id"]: {
            "platform_account_id": item["id"],
            "account_name": item["account_name"],
            "platform": item["platform"],
            "market": item.get("market"),
        }
        for item in cockpit["sections"]["store_matrix"]["items"]
    }
    product_ids = [
        item.get("product_id")
        for item in risks
        if item.get("type") == "inventory" and item.get("product_id")
    ]
    listing_ids = [
        item.get("listing_id")
        for item in risks
        if item.get("listing_id")
    ]
    listing_by_product: dict[str, dict] = {}
    if product_ids:
        result = await db.execute(
            select(PlatformListing).where(PlatformListing.product_id.in_(list(dict.fromkeys(product_ids))))
        )
        for listing in result.scalars().all():
            store = store_lookup.get(listing.platform_account_id)
            if store and listing.product_id not in listing_by_product:
                listing_by_product[listing.product_id] = store
    listing_by_id: dict[str, dict] = {}
    if listing_ids:
        result = await db.execute(
            select(PlatformListing).where(PlatformListing.id.in_(list(dict.fromkeys(listing_ids))))
        )
        for listing in result.scalars().all():
            store = store_lookup.get(listing.platform_account_id)
            if store:
                listing_by_id[listing.id] = {
                    **store,
                    "product_id": listing.product_id,
                }

    scoped = []
    for risk in risks:
        item = dict(risk)
        store = None
        if item.get("platform_account_id"):
            store = store_lookup.get(item["platform_account_id"])
        if not store and item.get("product_id"):
            store = listing_by_product.get(item["product_id"])
        if not store and item.get("listing_id"):
            store = listing_by_id.get(item["listing_id"])
        if store:
            item.update(store)
        item.setdefault("platform", item.get("platform") or "待定位平台")
        item.setdefault("platform_account_id", item.get("platform_account_id"))
        item.setdefault("account_name", item.get("account_name") or "待定位店铺")
        item.setdefault("market", item.get("market"))
        scoped.append(item)
    return scoped


async def _risk_period_comparison(db: AsyncSession, user_id: str, cockpit: dict) -> dict:
    active_filters = cockpit.get("active_filters") or {}
    start = date.fromisoformat(active_filters["start_date"])
    end = date.fromisoformat(active_filters["end_date"])
    days = max((end - start).days + 1, 1)
    previous_start = start - timedelta(days=days)
    previous_end = start - timedelta(days=1)
    year_start = start - timedelta(days=365)
    year_end = end - timedelta(days=365)
    previous = await _risk_snapshot_for_window(db, user_id, previous_start, previous_end)
    last_year = await _risk_snapshot_for_window(db, user_id, year_start, year_end)
    current = risk_snapshot(_build_risks(cockpit))
    return {
        "current": current,
        "previous": previous,
        "last_year": last_year,
        "rates": {
            "active_mom_pct": change_pct(current["active"], previous["active"]),
            "active_yoy_pct": change_pct(current["active"], last_year["active"]),
            "critical_mom_pct": change_pct(current["critical"], previous["critical"]),
            "critical_yoy_pct": change_pct(current["critical"], last_year["critical"]),
        },
        "windows": {
            "current": f"{start.isoformat()} 至 {end.isoformat()}",
            "previous": f"{previous_start.isoformat()} 至 {previous_end.isoformat()}",
            "last_year": f"{year_start.isoformat()} 至 {year_end.isoformat()}",
        },
    }


async def _risk_snapshot_for_window(db: AsyncSession, user_id: str, start: date, end: date) -> dict:
    cockpit = await get_operating_cockpit(db, user_id, start_date=start, end_date=end)
    return risk_snapshot(_build_risks(cockpit))


def _risk_store_matrix(risks: list[dict]) -> list[dict]:
    buckets: dict[tuple[str, str], dict] = {}
    for risk in risks:
        key = (risk.get("platform_account_id") or "unassigned", risk.get("platform") or "待定位平台")
        row = buckets.setdefault(key, {
            "platform_account_id": risk.get("platform_account_id"),
            "account_name": risk.get("account_name") or "待定位店铺",
            "platform": risk.get("platform") or "待定位平台",
            "market": risk.get("market"),
            "critical": 0,
            "warning": 0,
            "processing": 0,
            "overdue": 0,
            "total": 0,
        })
        row["total"] += 1
        if risk["severity"] == "critical":
            row["critical"] += 1
        elif risk["severity"] == "warning":
            row["warning"] += 1
        if risk["status"] == "processing":
            row["processing"] += 1
        if risk.get("is_overdue"):
            row["overdue"] += 1
    return sorted(buckets.values(), key=lambda item: (item["critical"], item["warning"], item["total"]), reverse=True)


def _risk_platform_matrix(risks: list[dict]) -> list[dict]:
    buckets: dict[str, dict] = {}
    for risk in risks:
        platform = risk.get("platform") or "待定位平台"
        row = buckets.setdefault(platform, {"platform": platform, "critical": 0, "warning": 0, "processing": 0, "overdue": 0, "total": 0})
        row["total"] += 1
        if risk["severity"] == "critical":
            row["critical"] += 1
        elif risk["severity"] == "warning":
            row["warning"] += 1
        if risk["status"] == "processing":
            row["processing"] += 1
        if risk.get("is_overdue"):
            row["overdue"] += 1
    return sorted(buckets.values(), key=lambda item: (item["critical"], item["warning"], item["total"]), reverse=True)


def _risk_categories(cockpit: dict, active_risks: list[dict]) -> list[dict]:
    counts = {item["key"]: 0 for item in RISK_CATEGORY_LIBRARY}
    for risk in active_risks:
        counts[risk["type"]] = counts.get(risk["type"], 0) + 1
    gaps_by_type = {
        "account": [] if cockpit["active_filters"].get("store_count", 0) else ["platform_accounts"],
        "business": cockpit["sections"]["store_matrix"]["data_gaps"],
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


def _complete_risk_operating_context(risk: dict, sla_templates: dict | None = None) -> dict:
    item = dict(risk)
    templates = sla_templates or RISK_SLA_TEMPLATES
    template_key = item.get("type") if item.get("type") in templates else "business"
    severity = item.get("severity") if item.get("severity") in ("critical", "warning", "info") else "warning"
    template_hours = templates.get(template_key, {}).get(severity)
    response_deadline_at = item.get("response_deadline_at") or None
    if not response_deadline_at and template_hours:
        response_deadline_at = (datetime.now(timezone.utc) + timedelta(hours=template_hours)).isoformat()
    sla_hours, remaining_time_label = _deadline_snapshot(response_deadline_at)
    item.setdefault("estimated_impact", _default_risk_impact(item))
    item.setdefault("response_deadline_at", response_deadline_at)
    item.setdefault("remaining_time_label", remaining_time_label)
    item.setdefault("sla_hours", sla_hours)
    item.setdefault("sla_template_key", template_key)
    item.setdefault("sla_template_hours", template_hours)
    return item


def _order_risk_impact(item: dict) -> str:
    currency = item.get("currency")
    total = item.get("total")
    if currency and total is not None:
        return f"订单金额 {currency} {_plain_amount(total)}，可能触发取消、退款或店铺履约扣分。"
    return "可能触发取消、退款或店铺履约扣分。"


def _default_risk_impact(risk: dict) -> str:
    risk_type = risk.get("type")
    if risk_type == "inventory":
        return "可能导致缺货、延迟发货、库存资金占用或错失销售。"
    if risk_type == "currency":
        return "可能导致利润判断偏差、资金投入失真或费用核算错误。"
    if risk_type == "compliance":
        return "可能触发平台限制、商品下架、投诉处理或店铺评分影响。"
    if risk_type == "business":
        return "可能造成资金占用、销售停滞、店铺经营效率下降或选品投放策略失效。"
    if risk_type == "logistics":
        return "可能触发订单取消、退款、平台履约扣分或买家体验下降。"
    return "影响范围待根据关联业务记录进一步确认。"


def _plain_amount(value) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if number.is_integer():
        return str(int(number))
    return f"{number:.2f}".rstrip("0").rstrip(".")


def _deadline_snapshot(value) -> tuple[Optional[int], str]:
    deadline = _parse_dt(value.isoformat() if isinstance(value, datetime) else value)
    if not deadline:
        return None, "未设置"
    seconds = (deadline - datetime.now(timezone.utc)).total_seconds()
    if seconds <= 0:
        return 0, "已超期"
    hours = max(1, int((seconds + 3599) // 3600))
    if hours < 48:
        return hours, f"剩余{hours}小时"
    days = max(1, int((hours + 23) // 24))
    return hours, f"剩余{days}天"


def _deadline_overdue(value, status: str) -> bool:
    if status in ("closed", "ignored"):
        return False
    deadline = _parse_dt(value.isoformat() if isinstance(value, datetime) else value)
    return bool(deadline and deadline < datetime.now(timezone.utc))


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


def _merge_state(risk: dict, state: Optional[RiskEventState], sla_templates: dict | None = None) -> dict:
    merged = _complete_risk_operating_context(risk, sla_templates)
    if not state:
        default_deadline = merged.get("response_deadline_at")
        merged.update({
            "assigned_to": None,
            "due_at": default_deadline,
            "is_overdue": _deadline_overdue(default_deadline, merged["status"]),
            "note": None,
            "closed_at": None,
            "updated_at": None,
        })
        return merged
    state_deadline = state.due_at.isoformat() if state.due_at else merged.get("response_deadline_at")
    sla_hours, remaining_time_label = _deadline_snapshot(state_deadline)
    merged.update({
        "status": state.status,
        "assigned_to": state.assigned_to,
        "due_at": state.due_at,
        "is_overdue": _deadline_overdue(state_deadline, state.status),
        "note": state.note,
        "closed_at": state.closed_at,
        "updated_at": state.updated_at,
        "remaining_time_label": remaining_time_label,
        "sla_hours": sla_hours,
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

from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.models.order import Order
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.platform_account import PlatformAccount
from app.models.sync_log import SyncLog
from app.schemas.order import OrderStatusUpdate, OrderNoteUpdate
from app.services.dictionary import get_all_dicts
from app.services.order_manual_service import create_manual_order, import_manual_orders
from app.services.store_access_service import list_accessible_store_ids_for_user_id


FEE_COMPONENT_LABELS = {
    "item_subtotal": "商品小计",
    "buyer_shipping_fee": "买家支付运费",
    "seller_discount": "卖家优惠",
    "platform_discount": "平台折扣",
    "platform_commission": "平台佣金",
    "transaction_fee": "交易费",
    "service_fee": "服务费",
    "tax": "税费",
    "refund": "退款",
    "buyer_paid": "买家支付总额",
}

ORDER_FINANCE_REVENUE_TYPES = {"revenue", "sales_income", "refund_reversal", "receivable", "accounts_receivable", "receivable_collection"}
ORDER_FINANCE_NON_PROFIT_TYPES = {"cash_balance", "platform_wallet_balance", "withdrawal"}
ORDER_FINANCE_PLATFORM_BILL_TYPES = {"platform_fee", "transaction_fee", "service_fee", "tax_fee", "refund"}


async def list_orders(
    db: AsyncSession,
    user_id: str,
    status: Optional[str] = None,
    platform: Optional[str] = None,
    platform_account_id: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    exceptions: bool = False,
    fulfillment_exception_status: Optional[str] = None,
    sync_status: Optional[str] = None,
    shipping_sla: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    if not store_ids:
        return [], 0
    if platform_account_id:
        if platform_account_id not in store_ids:
            return [], 0
        store_ids = [platform_account_id]
    query = select(Order).options(selectinload(Order.items)).where(Order.platform_account_id.in_(store_ids))

    if status:
        statuses = status.split(",")
        query = query.where(Order.status.in_(statuses))
    if platform:
        query = query.join(PlatformAccount, Order.platform_account_id == PlatformAccount.id)
        query = query.where(PlatformAccount.platform == platform)
    if search:
        query = query.where(
            or_(
                Order.order_number.ilike(f"%{search}%"),
                Order.buyer_name.ilike(f"%{search}%"),
            )
        )
    start = _parse_date(date_from)
    if start:
        query = query.where(Order.ordered_at >= start)
    end = _parse_date(date_to)
    if end:
        query = query.where(Order.ordered_at < end + timedelta(days=1))

    query = query.order_by(Order.ordered_at.desc())

    if exceptions or fulfillment_exception_status or sync_status or shipping_sla:
        result = await db.execute(query)
        candidate_orders = list(result.scalars().all())
        sync_reviews = await get_order_sync_reviews(db, candidate_orders) if sync_status else {}
        all_orders = []
        for order in candidate_orders:
            fulfillment_context = build_fulfillment_exception_context(order)
            if exceptions and fulfillment_context.get("status") == "clear":
                continue
            if fulfillment_exception_status and fulfillment_context.get("status") != fulfillment_exception_status:
                continue
            if shipping_sla and not _matches_shipping_sla(fulfillment_context, shipping_sla):
                continue
            if sync_status and sync_reviews.get(order.id, {}).get("status") != sync_status:
                continue
            all_orders.append(order)
        total = len(all_orders)
        start_index = (page - 1) * page_size
        return all_orders[start_index:start_index + page_size], total

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    orders = list(result.scalars().all())
    return orders, total


async def get_order(db: AsyncSession, order_id: str, user_id: str) -> Optional[Order]:
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    if not store_ids:
        return None
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.platform_account_id.in_(store_ids))
    )
    return result.scalar_one_or_none()


def build_order_fee_context(order: Order) -> dict:
    platform_data = order.platform_data if isinstance(order.platform_data, dict) else {}
    raw_breakdown = platform_data.get("fee_breakdown") if isinstance(platform_data.get("fee_breakdown"), dict) else {}
    raw_components = raw_breakdown.get("components") if isinstance(raw_breakdown.get("components"), list) else []
    components = [
        _fee_component("item_subtotal", order.subtotal, order.currency, "add", "order"),
        _fee_component("buyer_shipping_fee", order.shipping_fee, order.currency, "add", "order"),
        _fee_component("seller_discount", order.discount, order.currency, "deduct", "order"),
        _fee_component("platform_commission", order.platform_fee, order.currency, "deduct", "order"),
        _fee_component("buyer_paid", order.total, order.currency, "add", "order"),
    ]
    seen_codes = {item["code"] for item in components if item["amount"] is not None}
    for item in raw_components:
        if not isinstance(item, dict):
            continue
        code = str(item.get("code") or "").strip()
        if not code or code in seen_codes:
            continue
        components.append({
            "code": code,
            "label": item.get("label") or FEE_COMPONENT_LABELS.get(code, code),
            "amount": item.get("amount"),
            "currency": item.get("currency") or order.currency,
            "direction": item.get("direction") or "deduct",
            "source": item.get("source") or "platform_bill",
            "status": item.get("status") or "observed",
        })
        seen_codes.add(code)
    components = [item for item in components if item["amount"] is not None]
    reconciliation_status = platform_data.get("financial_reconciliation_status") or raw_breakdown.get("reconciliation_status") or "not_reconciled"
    data_gaps = []
    if reconciliation_status not in {"bill_imported", "reconciled"}:
        data_gaps.append("platform_bill")
    if order.platform_fee is None and not any(item["code"] == "platform_commission" for item in components):
        data_gaps.append("platform_commission")
    if not any(item["code"] == "buyer_paid" for item in components):
        data_gaps.append("buyer_paid")
    wallet = raw_breakdown.get("wallet") if isinstance(raw_breakdown.get("wallet"), dict) else {}
    return {
        "fee_breakdown": {
            "components": components,
            "wallet": wallet,
            "data_gaps": list(dict.fromkeys(data_gaps)),
            "confidence_reason": "费用组成读取订单字段和平台账单明细；缺平台账单时不推导完整利润。",
        },
        "fulfillment_deadline_at": platform_data.get("fulfillment_deadline_at"),
        "logistics_channel": platform_data.get("logistics_channel"),
        "after_sales_status": platform_data.get("after_sales_status") or "unknown",
        "financial_reconciliation_status": reconciliation_status,
    }


async def build_order_finance_entry_context(db: AsyncSession, order: Order) -> dict:
    result = await db.execute(
        select(FinanceLedgerEntry)
        .where(
            FinanceLedgerEntry.user_id == order.user_id,
            FinanceLedgerEntry.order_id == order.id,
        )
        .order_by(FinanceLedgerEntry.occurred_at.desc())
    )
    entries = list(result.scalars().all())
    revenue_entries = [entry for entry in entries if entry.entry_type in ORDER_FINANCE_REVENUE_TYPES]
    cost_entries = [
        entry for entry in entries
        if entry.entry_type not in ORDER_FINANCE_REVENUE_TYPES and entry.entry_type not in ORDER_FINANCE_NON_PROFIT_TYPES
    ]
    platform_bill_entries = [entry for entry in entries if entry.entry_type in ORDER_FINANCE_PLATFORM_BILL_TYPES]
    refund_entries = [entry for entry in entries if entry.entry_type == "refund"]
    data_gaps: list[str] = []

    if not entries:
        data_gaps.append("finance_ledger_entries")
    if not revenue_entries:
        data_gaps.append("finance_ledger_entries.revenue")
    if not platform_bill_entries:
        data_gaps.append("platform_bill")

    revenue_rmb = _sum_ledger_amount(revenue_entries) if revenue_entries else None
    cost_rmb = _sum_ledger_amount(cost_entries) if cost_entries else None
    net_profit_rmb = round(revenue_rmb - cost_rmb, 2) if revenue_rmb is not None and cost_rmb is not None and not data_gaps else None
    status = "ledger_ready" if entries and not data_gaps else "ledger_incomplete"
    if not entries:
        status = "ledger_missing"

    actions = [
        {
            "code": "view_order_ledger",
            "label": "查看订单财务流水",
            "route": f"/finance?order_id={order.id}#finance-ledger",
            "reason": "查看当前订单已关联的真实财务台账",
        }
    ]
    if not revenue_entries:
        actions.append({
            "code": "record_sales_income",
            "label": "补录销售收入",
            "route": f"/finance?entry_type=sales_income&order_id={order.id}#finance-ledger",
            "reason": "当前订单尚无销售收入台账，不能作为已入账收入",
        })
    if not platform_bill_entries:
        actions.append({
            "code": "replenish_platform_bill",
            "label": "补录平台账单",
            "route": f"/finance?entry_type=platform_fee&order_id={order.id}#finance-ledger",
            "reason": "缺平台费用、交易费、税费或退款流水时不计算完整订单利润",
        })

    return {
        "status": status,
        "entry_count": len(entries),
        "revenue_rmb": revenue_rmb,
        "cost_rmb": cost_rmb,
        "net_profit_rmb": net_profit_rmb,
        "platform_bill_entry_count": len(platform_bill_entries),
        "refund_rmb": _sum_ledger_amount(refund_entries) if refund_entries else 0,
        "data_gaps": data_gaps,
        "actions": actions,
        "recent_entries": [
            {
                "id": entry.id,
                "entry_type": entry.entry_type,
                "amount_rmb": round(float(entry.amount_rmb or 0), 2),
                "currency": entry.currency,
                "description": entry.description,
                "occurred_at": entry.occurred_at.isoformat() if entry.occurred_at else None,
            }
            for entry in entries[:5]
        ],
        "confidence_reason": "订单财务入账状态只统计已关联当前订单 ID 的真实财务台账；缺收入或平台账单时不推导完整利润。",
    }


def _sum_ledger_amount(entries: list[FinanceLedgerEntry]) -> float:
    return round(sum(float(entry.amount_rmb or 0) for entry in entries), 2)


def build_fulfillment_exception_context(order: Order, now: datetime | None = None) -> dict:
    platform_data = order.platform_data if isinstance(order.platform_data, dict) else {}
    now = _aware(now or datetime.now(timezone.utc))
    deadline = _parse_datetime(platform_data.get("fulfillment_deadline_at"))
    after_sales_status = platform_data.get("after_sales_status")
    logistics_channel = platform_data.get("logistics_channel")
    source = platform_data.get("source", "platform")
    terminal_statuses = {"completed", "delivered", "cancelled", "refunded", "closed"}
    active_order = order.status not in terminal_statuses
    reasons: list[str] = []
    data_gaps: list[str] = []
    status = "clear"
    severity = "clear"

    if active_order and deadline:
        if now > deadline:
            status = "shipping_overdue"
            severity = "critical"
            reasons.append("发货时限已超期")
        elif deadline - now <= timedelta(hours=12):
            status = "shipping_due_soon"
            severity = "warning"
            reasons.append("距离平台发货时限不足12小时")
    elif active_order:
        data_gaps.append("fulfillment_deadline_at")

    if active_order and not logistics_channel:
        if status == "clear":
            status = "logistics_missing"
            severity = "warning"
        reasons.append("物流渠道待补")
        data_gaps.append("logistics_channel")

    if after_sales_status and after_sales_status not in {"none", "no_after_sales", "closed", "resolved", "completed"}:
        if severity != "critical":
            status = "after_sales_open"
            severity = "warning"
        reasons.append(f"售后状态待处理：{after_sales_status}")
        data_gaps.append("after_sales_resolution")

    if source == "manual" or not order.last_synced_at:
        if status == "clear":
            status = "sync_required"
            severity = "warning"
        reasons.append("订单缺少平台同步时间")
        data_gaps.append("platform_order_sync")

    return {
        "status": status,
        "severity": severity,
        "reasons": reasons,
        "deadline_at": _iso(deadline),
        "hours_to_deadline": _hours_between(now, deadline) if deadline else None,
        "logistics_channel": logistics_channel,
        "after_sales_status": after_sales_status,
        "fulfillment_status": order.fulfillment_status,
        "route": "/orders?exceptions=1",
        "data_gaps": list(dict.fromkeys(data_gaps)),
        "actions": _fulfillment_exception_actions(order, status, after_sales_status, logistics_channel, data_gaps),
    }


def _fulfillment_exception_actions(
    order: Order,
    status: str,
    after_sales_status: str | None,
    logistics_channel: str | None,
    data_gaps: list[str],
) -> list[dict]:
    platform_data = order.platform_data if isinstance(order.platform_data, dict) else {}
    actions = []
    if status in {"shipping_overdue", "shipping_due_soon", "logistics_missing"} or not logistics_channel:
        actions.append({
            "code": "create_shipment",
            "label": "创建物流/发货记录",
            "route": f"/shipments/new?order_id={order.id}",
            "priority": "high" if status == "shipping_overdue" else "medium",
            "description": "补齐物流渠道、运单号和发货记录后再跟踪平台履约状态。",
        })
    if after_sales_status and after_sales_status not in {"none", "no_after_sales", "closed", "resolved", "completed"}:
        actions.append({
            "code": "review_after_sales",
            "label": "处理售后跟进",
            "route": f"/orders/after-sales?order_id={order.id}",
            "priority": "high",
            "description": "进入售后处理页登记退款、退货或争议跟进，真实售后单仍以平台接口为准。",
        })
    if "platform_order_sync" in data_gaps:
        actions.append({
            "code": "sync_platform_order",
            "label": "同步/检查平台订单",
            "route": f"/platforms?platform_account_id={order.platform_account_id}&sync_type=orders",
            "priority": "medium",
            "description": "检查店铺授权和订单同步能力；未接通平台 API 时保留手工订单标记。",
        })
    reconciliation_status = platform_data.get("financial_reconciliation_status", "not_reconciled")
    if reconciliation_status not in {"bill_imported", "reconciled"}:
        actions.append({
            "code": "replenish_platform_bill",
            "label": "补录平台账单",
            "route": f"/finance?entry_type=platform_fee&order_id={order.id}#finance-ledger",
            "priority": "medium",
            "description": "补齐平台费、交易费、退款等账单后再做订单利润判断。",
        })
    return actions


def build_order_list_context(order: Order, now: datetime | None = None) -> dict:
    platform_data = order.platform_data if isinstance(order.platform_data, dict) else {}
    loaded_items = order.__dict__.get("items") or []
    return {
        "platform_account_name": order.platform_account.account_name if order.platform_account else None,
        "item_count": len(loaded_items),
        "payment_status": order.payment_status,
        "fulfillment_status": order.fulfillment_status,
        "fulfillment_deadline_at": platform_data.get("fulfillment_deadline_at"),
        "logistics_channel": platform_data.get("logistics_channel"),
        "after_sales_status": platform_data.get("after_sales_status"),
        "financial_reconciliation_status": platform_data.get("financial_reconciliation_status", "not_reconciled"),
        "fulfillment_exception": build_fulfillment_exception_context(order, now=now),
    }


def _matches_shipping_sla(fulfillment_context: dict, shipping_sla: str) -> bool:
    status = fulfillment_context.get("status")
    hours = fulfillment_context.get("hours_to_deadline")
    if shipping_sla == "overdue":
        return status == "shipping_overdue"
    if shipping_sla == "due_soon":
        return status == "shipping_due_soon"
    if shipping_sla == "missing_deadline":
        return "fulfillment_deadline_at" in (fulfillment_context.get("data_gaps") or [])
    if shipping_sla == "within_12h":
        return isinstance(hours, (int, float)) and 0 <= hours <= 12
    if shipping_sla == "within_24h":
        return isinstance(hours, (int, float)) and 0 <= hours <= 24
    return True


async def get_order_sync_reviews(db: AsyncSession, orders: list[Order]) -> dict[str, dict]:
    account_ids = list({order.platform_account_id for order in orders if order.platform_account_id})
    if not account_ids:
        return {}
    result = await db.execute(
        select(SyncLog)
        .where(SyncLog.platform_account_id.in_(account_ids), SyncLog.sync_type == "orders")
        .order_by(SyncLog.started_at.desc())
    )
    latest_by_account: dict[str, SyncLog] = {}
    for log in result.scalars().all():
        if log.platform_account_id not in latest_by_account:
            latest_by_account[log.platform_account_id] = log
    return {
        order.id: _order_sync_review(order, latest_by_account.get(order.platform_account_id))
        for order in orders
    }


def _order_sync_review(order: Order, latest_log: SyncLog | None) -> dict:
    platform_data = order.platform_data if isinstance(order.platform_data, dict) else {}
    source = platform_data.get("source", "platform")
    latest = _sync_log_snapshot(latest_log)
    data_gaps = []
    if source == "manual":
        data_gaps.append("platform_order_sync")
        return {
            "status": "manual_not_synced",
            "source": source,
            "order_last_synced_at": None,
            "latest_store_sync": latest,
            "message": "该订单为手工录入，尚未经过平台订单 API 同步。",
            "data_gaps": data_gaps,
        }
    if not order.last_synced_at:
        data_gaps.append("order_last_synced_at")
    if latest_log and latest_log.status in {"failed", "partial_failed", "blocked"}:
        if latest_log.status == "partial_failed":
            message = "店铺最近一次订单同步部分失败，请复核失败记录。"
        else:
            message = "店铺最近一次订单同步失败，请复核平台 API 凭证或重试同步。"
        return {
            "status": "sync_failed",
            "source": source,
            "order_last_synced_at": _iso(order.last_synced_at),
            "latest_store_sync": latest,
            "message": message,
            "data_gaps": data_gaps + ["platform_order_sync"],
        }
    if order.last_synced_at:
        return {
            "status": "synced",
            "source": source,
            "order_last_synced_at": _iso(order.last_synced_at),
            "latest_store_sync": latest,
            "message": "订单来自平台同步快照，仍需结合平台账单完成费用对账。",
            "data_gaps": data_gaps,
        }
    return {
        "status": "not_synced",
        "source": source,
        "order_last_synced_at": None,
        "latest_store_sync": latest,
        "message": "订单缺少平台同步时间，需执行平台订单同步或保留为手工记录。",
        "data_gaps": data_gaps,
    }


def _sync_log_snapshot(log: SyncLog | None) -> dict | None:
    if not log:
        return None
    return {
        "sync_log_id": log.id,
        "sync_type": log.sync_type,
        "status": log.status,
        "started_at": _iso(log.started_at),
        "completed_at": _iso(log.completed_at),
        "records_processed": log.records_processed or 0,
        "records_created": log.records_created or 0,
        "records_updated": log.records_updated or 0,
        "records_failed": log.records_failed or 0,
        "error_message": log.error_message,
    }


def _fee_component(code: str, amount: float | None, currency: str, direction: str, source: str) -> dict:
    return {
        "code": code,
        "label": FEE_COMPONENT_LABELS.get(code, code),
        "amount": amount,
        "currency": currency,
        "direction": direction,
        "source": source,
        "status": "observed" if amount is not None else "missing",
    }


async def update_order_status(db: AsyncSession, order: Order, req: OrderStatusUpdate):
    await _validate_order_status_transition(db, order.status, req)
    old_status = order.status
    transition_type = "manual_override" if req.manual_override else "state_machine"
    order.status = req.status
    order.platform_data = {
        **(order.platform_data or {}),
        "status_history": [
            *((order.platform_data or {}).get("status_history") or []),
            {
                "from": old_status,
                "to": req.status,
                "transition_type": transition_type,
                "reason": req.reason or "",
                "changed_at": datetime.now(timezone.utc).isoformat(),
            },
        ],
    }
    await db.commit()
    await db.refresh(order)
    return order


async def _validate_order_status_transition(db: AsyncSession, current_status: str, req: OrderStatusUpdate) -> None:
    dictionaries = await get_all_dicts(db)
    statuses = dictionaries.get("order_statuses") or []
    status_by_id = {item.get("id"): item for item in statuses if item.get("id")}
    if not status_by_id:
        raise ValueError("order_status_dictionary_missing")
    if req.status not in status_by_id:
        raise ValueError("unknown_order_status")
    if req.status == current_status:
        return
    if req.manual_override:
        if not (req.reason or "").strip():
            raise ValueError("manual_override_reason_required")
        return
    current = status_by_id.get(current_status)
    if not current:
        raise ValueError("current_order_status_unknown")
    allowed_next = current.get("allowed_next") or []
    if req.status not in allowed_next:
        raise ValueError("invalid_order_status_transition")


async def update_order_notes(db: AsyncSession, order: Order, req: OrderNoteUpdate):
    order.notes = req.notes
    await db.commit()
    await db.refresh(order)
    return order


async def get_order_stats(db: AsyncSession, user_id: str, now: datetime | None = None) -> dict:
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    if not store_ids:
        return {}
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.platform_account_id.in_(store_ids))
    )
    orders = list(result.scalars().all())
    now = now or datetime.now(timezone.utc)
    by_order_status: dict[str, int] = {}
    by_fulfillment_status: dict[str, int] = {}
    store_map: dict[str, dict] = {}
    fulfillment = {
        "pending_shipment": 0,
        "shipped": 0,
        "due_soon": 0,
        "overdue": 0,
        "logistics_missing": 0,
        "after_sales_open": 0,
        "sync_required": 0,
        "missing_deadline": 0,
        "data_gap_count": 0,
    }
    for order in orders:
        by_order_status[order.status] = by_order_status.get(order.status, 0) + 1
        if order.fulfillment_status:
            by_fulfillment_status[order.fulfillment_status] = by_fulfillment_status.get(order.fulfillment_status, 0) + 1
        if _is_shipped_order(order):
            fulfillment["shipped"] += 1
        elif _is_active_order(order):
            fulfillment["pending_shipment"] += 1

        exception = build_fulfillment_exception_context(order, now=now)
        if exception["status"] == "shipping_due_soon":
            fulfillment["due_soon"] += 1
        if exception["status"] == "shipping_overdue":
            fulfillment["overdue"] += 1
        if "logistics_channel" in exception["data_gaps"]:
            fulfillment["logistics_missing"] += 1
        if "after_sales_resolution" in exception["data_gaps"]:
            fulfillment["after_sales_open"] += 1
        if "platform_order_sync" in exception["data_gaps"]:
            fulfillment["sync_required"] += 1
        if "fulfillment_deadline_at" in exception["data_gaps"]:
            fulfillment["missing_deadline"] += 1
        fulfillment["data_gap_count"] += len(exception["data_gaps"])

        account = order.platform_account
        key = order.platform_account_id
        if key not in store_map:
            store_map[key] = {
                "platform_account_id": key,
                "platform": account.platform if account else "",
                "platform_account_name": account.account_name if account else "店铺未命名",
                "total_orders": 0,
                "pending_shipment": 0,
                "shipped": 0,
                "due_soon": 0,
                "overdue": 0,
            }
        store = store_map[key]
        store["total_orders"] += 1
        if _is_shipped_order(order):
            store["shipped"] += 1
        elif _is_active_order(order):
            store["pending_shipment"] += 1
        if exception["status"] == "shipping_due_soon":
            store["due_soon"] += 1
        if exception["status"] == "shipping_overdue":
            store["overdue"] += 1

    return {
        "total_orders": len(orders),
        "by_order_status": by_order_status,
        "by_fulfillment_status": by_fulfillment_status,
        "fulfillment": fulfillment,
        "store_breakdown": sorted(
            store_map.values(),
            key=lambda item: (item["overdue"], item["due_soon"], item["pending_shipment"], item["total_orders"]),
            reverse=True,
        ),
        "data_gaps": _order_stats_data_gaps(fulfillment),
        "confidence_reason": "订单履约总览直接聚合当前用户可访问店铺订单、平台发货时限、履约状态和同步缺口；缺失字段进入数据缺口，不推导平台时限。",
    }


def _is_shipped_order(order: Order) -> bool:
    shipped_statuses = {"fulfilled", "shipped", "in_transit", "delivered", "completed", "done"}
    return (order.status in shipped_statuses) or ((order.fulfillment_status or "") in shipped_statuses)


def _is_active_order(order: Order) -> bool:
    inactive_statuses = {"completed", "delivered", "cancelled", "refunded", "closed"}
    return order.status not in inactive_statuses


def _order_stats_data_gaps(fulfillment: dict) -> list[str]:
    gaps = []
    if fulfillment.get("missing_deadline"):
        gaps.append("部分订单缺少平台发货时限")
    if fulfillment.get("logistics_missing"):
        gaps.append("部分订单缺少物流渠道")
    if fulfillment.get("sync_required"):
        gaps.append("部分订单缺少平台同步时间")
    return gaps


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return _aware(parsed)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _hours_between(start: datetime, end: datetime | None) -> float | None:
    if not end:
        return None
    return round((end - start).total_seconds() / 3600, 2)


def _iso(value) -> Optional[str]:
    return value.isoformat() if value else None

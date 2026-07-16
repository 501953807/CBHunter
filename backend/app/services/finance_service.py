"""Finance ledger service."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.errors import PlatformOperationUnavailable
from app.integrations.factory import PlatformClientFactory
from app.integrations.status import get_platform_connector_status
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.platform_account import PlatformAccount
from app.models.sync_log import SyncLog
from app.models.sys_dict import SysDictItem
from app.services.evidence_service import evidence_payload, source_ref
from app.utils.encryption import decrypt

REVENUE_TYPES = {"revenue", "sales_income", "refund_reversal", "receivable", "accounts_receivable", "receivable_collection"}
CASH_BALANCE_TYPE = "cash_balance"
PLATFORM_WALLET_BALANCE_TYPE = "platform_wallet_balance"
NON_PROFIT_LOSS_TYPES = {CASH_BALANCE_TYPE, PLATFORM_WALLET_BALANCE_TYPE, "withdrawal"}
SETTLEMENT_MOVEMENT_TYPES = (
    "withdrawal",
    "supplier_payment",
    "platform_fee",
    "transaction_fee",
    "service_fee",
    "tax_fee",
    "refund",
)
PLATFORM_BILL_TYPES = {"platform_fee", "transaction_fee", "service_fee", "tax_fee", "refund"}
PLATFORM_BILL_IMPORT_TYPES = PLATFORM_BILL_TYPES | {"supplier_payment", "shipping_cost"}


async def create_ledger_entry(db: AsyncSession, user_id: str, data: dict) -> FinanceLedgerEntry:
    """Create a real finance ledger entry."""
    entry = FinanceLedgerEntry(
        user_id=user_id,
        entry_type=data["entry_type"],
        amount_rmb=data["amount_rmb"],
        amount_original=data.get("amount_original"),
        currency=data.get("currency") or "CNY",
        platform=data.get("platform"),
        market=data.get("market"),
        order_id=data.get("order_id"),
        sourcing_item_id=data.get("sourcing_item_id"),
        description=data.get("description"),
        extra=data.get("extra") or {},
        occurred_at=data.get("occurred_at") or datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def import_platform_bill_records(
    db: AsyncSession,
    user_id: str,
    records: list[dict],
    *,
    source: str = "platform_bill_import",
    platform_account_id: str | None = None,
) -> dict:
    """Import platform bill rows into real finance ledger entries."""
    imported: list[FinanceLedgerEntry] = []
    skipped: list[dict] = []
    for record in records:
        entry_type = str(record.get("entry_type") or "").strip()
        import_ref = str(record.get("import_ref") or "").strip()
        if entry_type not in PLATFORM_BILL_IMPORT_TYPES:
            skipped.append({"import_ref": import_ref or None, "reason": "unsupported_entry_type"})
            continue
        if import_ref and await _has_import_ref(db, user_id, import_ref):
            skipped.append({"import_ref": import_ref, "reason": "duplicate_import_ref"})
            continue
        extra = {
            "source": source,
            "import_ref": import_ref or None,
            "platform_account_id": platform_account_id or record.get("platform_account_id"),
            "account_name": record.get("account_name"),
            "product_name": record.get("product_name"),
        }
        extra = {key: value for key, value in extra.items() if value not in (None, "")}
        entry = FinanceLedgerEntry(
            user_id=user_id,
            entry_type=entry_type,
            amount_rmb=round(float(record["amount_rmb"]), 2),
            amount_original=record.get("amount_original"),
            currency=record.get("currency") or "CNY",
            platform=record.get("platform"),
            market=record.get("market"),
            order_id=record.get("order_id"),
            sourcing_item_id=record.get("sourcing_item_id"),
            description=record.get("description") or f"平台账单导入 {entry_type}",
            extra=extra,
            occurred_at=record.get("occurred_at") or datetime.now(timezone.utc),
        )
        db.add(entry)
        imported.append(entry)
    await db.commit()
    for entry in imported:
        await db.refresh(entry)
    return {
        "imported_count": len(imported),
        "skipped_count": len(skipped),
        "imported_entry_ids": [entry.id for entry in imported],
        "skipped": skipped,
    }


async def sync_platform_bills_for_account(
    db: AsyncSession,
    user_id: str,
    platform_account_id: str,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> dict:
    """Synchronize platform bill records through a real platform adapter when available."""
    account = await _get_owned_platform_account(db, user_id, platform_account_id)
    now = datetime.now(timezone.utc)
    start_at = start_at or now - timedelta(days=7)
    end_at = end_at or now
    log = SyncLog(
        user_id=user_id,
        platform_account_id=account.id,
        sync_type="platform_bills",
        status="running",
        started_at=now,
    )
    db.add(log)
    await db.commit()
    try:
        connector_status = get_platform_connector_status(account)
        if connector_status["connection_status"] != "unverified":
            gap = f"platform_bill_open_api.{connector_status['connection_status']}"
            await _finish_platform_bill_sync_log(db, log, "blocked", gap, processed=0, created=0, skipped=0)
            return _platform_bill_sync_result(log, account, connector_status, _empty_import_result(), [gap])
        if not connector_status["operations"].get("finance_bills"):
            gap = "platform_bill_open_api.not_implemented"
            await _finish_platform_bill_sync_log(db, log, "blocked", gap, processed=0, created=0, skipped=0)
            return _platform_bill_sync_result(log, account, connector_status, _empty_import_result(), [gap])

        client = PlatformClientFactory.get_client(account.platform, account, decrypt)
        if not client:
            gap = "platform_bill_open_api.unsupported"
            await _finish_platform_bill_sync_log(db, log, "blocked", gap, processed=0, created=0, skipped=0)
            return _platform_bill_sync_result(log, account, connector_status, _empty_import_result(), [gap])
        if not await client.authenticate():
            gap = "platform_bill_open_api.auth_failed"
            await _finish_platform_bill_sync_log(db, log, "blocked", gap, processed=0, created=0, skipped=0)
            return _platform_bill_sync_result(log, account, connector_status, _empty_import_result(), [gap])

        remote_records = await _fetch_platform_bill_pages(client, start_at, end_at)
        import_result = await import_platform_bill_records(
            db,
            user_id,
            [
                {
                    "import_ref": item.import_ref,
                    "entry_type": item.entry_type,
                    "amount_rmb": item.amount_rmb,
                    "amount_original": item.amount_original,
                    "currency": item.currency,
                    "platform": account.platform,
                    "market": (account.settings or {}).get("market"),
                    "order_id": item.order_id,
                    "sourcing_item_id": item.sourcing_item_id,
                    "platform_account_id": account.id,
                    "account_name": item.account_name or account.account_name,
                    "product_name": item.product_name,
                    "description": item.description,
                    "occurred_at": item.occurred_at,
                }
                for item in remote_records
            ],
            source="platform_bill_sync",
            platform_account_id=account.id,
        ) if remote_records else _empty_import_result()
        await _finish_platform_bill_sync_log(
            db,
            log,
            "success",
            "",
            processed=len(remote_records),
            created=import_result["imported_count"],
            skipped=import_result["skipped_count"],
        )
        return _platform_bill_sync_result(log, account, connector_status, import_result, [])
    except PlatformOperationUnavailable as exc:
        gap = f"platform_bill_open_api.{exc.operation}.not_available"
        await _finish_platform_bill_sync_log(db, log, "blocked", str(exc), processed=0, created=0, skipped=0)
        return _platform_bill_sync_result(log, account, get_platform_connector_status(account), _empty_import_result(), [gap])
    except Exception as exc:
        await _finish_platform_bill_sync_log(db, log, "failed", str(exc), processed=0, created=0, skipped=0)
        raise


async def list_ledger_entries(
    db: AsyncSession,
    user_id: str,
    page: int = 1,
    page_size: int = 50,
    entry_type: Optional[str] = None,
    platform_account_id: Optional[str] = None,
    order_id: Optional[str] = None,
) -> tuple[list[FinanceLedgerEntry], int]:
    """List finance ledger entries with pagination."""
    query = select(FinanceLedgerEntry).where(FinanceLedgerEntry.user_id == user_id)
    count_query = select(func.count(FinanceLedgerEntry.id)).where(FinanceLedgerEntry.user_id == user_id)
    if entry_type:
        query = query.where(FinanceLedgerEntry.entry_type == entry_type)
        count_query = count_query.where(FinanceLedgerEntry.entry_type == entry_type)
    if platform_account_id:
        query = query.where(FinanceLedgerEntry.extra["platform_account_id"].as_string() == platform_account_id)
        count_query = count_query.where(FinanceLedgerEntry.extra["platform_account_id"].as_string() == platform_account_id)
    if order_id:
        query = query.where(FinanceLedgerEntry.order_id == order_id)
        count_query = count_query.where(FinanceLedgerEntry.order_id == order_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    result = await db.execute(
        query.order_by(FinanceLedgerEntry.occurred_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all()), total


async def _has_import_ref(db: AsyncSession, user_id: str, import_ref: str) -> bool:
    result = await db.execute(
        select(FinanceLedgerEntry).where(FinanceLedgerEntry.user_id == user_id)
    )
    return any((entry.extra or {}).get("import_ref") == import_ref for entry in result.scalars().all())


async def _get_owned_platform_account(db: AsyncSession, user_id: str, platform_account_id: str) -> PlatformAccount:
    result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.id == platform_account_id,
            PlatformAccount.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise ValueError("平台店铺不存在或无权访问")
    return account


async def _fetch_platform_bill_pages(client, start_at: datetime, end_at: datetime) -> list:
    records = []
    seen_refs = set()
    page = 1
    page_size = 100
    while page <= 1000:
        items, total = await client.get_finance_bills(start_at, end_at, page=page, page_size=page_size)
        if not items:
            break
        for item in items:
            if item.import_ref not in seen_refs:
                records.append(item)
                seen_refs.add(item.import_ref)
        if total is not None and len(records) >= total:
            break
        page += 1
    return records


async def _finish_platform_bill_sync_log(
    db: AsyncSession,
    log: SyncLog,
    status: str,
    message: str,
    *,
    processed: int,
    created: int,
    skipped: int,
) -> None:
    log.status = status
    log.completed_at = datetime.now(timezone.utc)
    log.records_processed = processed
    log.records_created = created
    log.records_updated = 0
    log.records_failed = skipped if status == "success" else processed
    log.error_message = message or None
    log.error_details = [{"reason": message}] if message else []
    await db.commit()


def _empty_import_result() -> dict:
    return {"imported_count": 0, "skipped_count": 0, "imported_entry_ids": [], "skipped": []}


def _platform_bill_sync_result(
    log: SyncLog,
    account: PlatformAccount,
    connector_status: dict,
    import_result: dict,
    data_gaps: list[str],
) -> dict:
    return {
        "sync_log_id": log.id,
        "status": log.status,
        "platform_account_id": account.id,
        "platform": account.platform,
        "account_name": account.account_name,
        "connection_status": connector_status.get("connection_status"),
        "implementation_status": connector_status.get("implementation_status"),
        "import_result": import_result,
        "data_gaps": data_gaps,
        "message": connector_status.get("message"),
        "next_action": connector_status.get("next_action"),
    }


async def list_entry_type_options(db: AsyncSession, user_id: str) -> list[dict]:
    """List finance entry type options from dictionary and user's ledger history."""
    dict_result = await db.execute(
        select(SysDictItem).where(
            SysDictItem.type == "finance_entry_type",
            SysDictItem.is_active.is_(True),
        ).order_by(SysDictItem.sort_order)
    )
    options = [
        {"id": item.id, "label": item.label, "source": "dictionary"}
        for item in dict_result.scalars().all()
    ]
    known_ids = {item["id"] for item in options}

    history_result = await db.execute(
        select(FinanceLedgerEntry.entry_type)
        .where(FinanceLedgerEntry.user_id == user_id)
        .group_by(FinanceLedgerEntry.entry_type)
        .order_by(FinanceLedgerEntry.entry_type)
    )
    for entry_type in history_result.scalars().all():
        if entry_type not in known_ids:
            options.append({"id": entry_type, "label": entry_type, "source": "history"})
    return options


async def get_finance_summary(
    db: AsyncSession,
    user_id: str,
    period: str = "daily",
    platform_account_id: str | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> dict:
    """Summarize real ledger entries for a period."""
    explicit_range = start_at is not None or end_at is not None
    start_at = start_at or _period_start(period)
    now = end_at or datetime.now(timezone.utc)
    account = await _get_owned_platform_account(db, user_id, platform_account_id) if platform_account_id else None
    entry_filters = [
        FinanceLedgerEntry.user_id == user_id,
        FinanceLedgerEntry.occurred_at >= start_at,
        FinanceLedgerEntry.occurred_at <= now,
    ]
    future_filters = [
        FinanceLedgerEntry.user_id == user_id,
        FinanceLedgerEntry.occurred_at > now,
    ]
    if platform_account_id:
        entry_filters.append(FinanceLedgerEntry.extra["platform_account_id"].as_string() == platform_account_id)
        future_filters.append(FinanceLedgerEntry.extra["platform_account_id"].as_string() == platform_account_id)
    result = await db.execute(
        select(FinanceLedgerEntry).where(*entry_filters)
    )
    entries = list(result.scalars().all())
    future_count = 0 if explicit_range else await db.scalar(
        select(func.count(FinanceLedgerEntry.id)).where(*future_filters)
    )
    revenue_entries = [entry for entry in entries if entry.entry_type in REVENUE_TYPES]
    cost_entries = [
        entry for entry in entries
        if entry.entry_type not in REVENUE_TYPES and entry.entry_type not in NON_PROFIT_LOSS_TYPES
    ]

    total_revenue = _sum_amount(revenue_entries) if revenue_entries else None
    total_cost = _sum_amount(cost_entries) if cost_entries else None
    net_profit = None
    profit_margin = None
    if total_revenue is not None and total_cost is not None:
        net_profit = round(total_revenue - total_cost, 2)
        profit_margin = round((net_profit / total_revenue) * 100, 1) if total_revenue else None

    cash_balance = await _latest_cash_balance(db, user_id, platform_account_id=platform_account_id, as_at=now)
    data_gaps = []
    if not entries:
        data_gaps.append("finance_ledger_entries.store_scope" if platform_account_id else "finance_ledger_entries")
    if entries and not revenue_entries:
        data_gaps.append("finance_ledger_entries.revenue")
    if entries and not cost_entries:
        data_gaps.append("finance_ledger_entries.cost")
    if cash_balance is None:
        data_gaps.append("finance_ledger_entries.cash_balance")
    if not any(entry.entry_type == PLATFORM_WALLET_BALANCE_TYPE for entry in entries):
        data_gaps.append("finance_ledger_entries.platform_wallet_balance")
    if not any(entry.entry_type == "withdrawal" for entry in entries):
        data_gaps.append("finance_ledger_entries.withdrawal")
    if not any(entry.entry_type in {"platform_fee", "transaction_fee", "service_fee"} for entry in entries):
        data_gaps.append("finance_ledger_entries.platform_bill")
    if future_count:
        data_gaps.append(f"{future_count} 条未来发生日期台账未计入当前筛选日期范围")
    cost_breakdown = _cost_breakdown(cost_entries)
    risk_signals = _finance_risk_signals(
        entries=entries,
        revenue_entries=revenue_entries,
        cost_entries=cost_entries,
        cost_breakdown=cost_breakdown,
        total_revenue=total_revenue,
        total_cost=total_cost,
        net_profit=net_profit,
        cash_balance=cash_balance,
        platform_account_id=platform_account_id,
        future_count=future_count or 0,
    )
    return {
        "period": period,
        "total_revenue_rmb": total_revenue,
        "total_cost_rmb": total_cost,
        "net_profit_rmb": net_profit,
        "profit_margin_pct": profit_margin,
        "cash_balance_rmb": cash_balance,
        "entry_count": len(entries),
        "cost_breakdown": cost_breakdown,
        "platform_settlement": _platform_settlement(entries),
        "risk_signals": risk_signals,
        "data_status": "ready" if entries else "data_required",
        **evidence_payload(
            source_refs=[
                source_ref(
                    "finance_ledger_entry",
                    entry.id,
                    field=entry.entry_type,
                    label=entry.description or entry.entry_type,
                    meta={
                        "source_label": "财务台账",
                        "route": f"/finance?platform_account_id={platform_account_id}" if platform_account_id else "/finance",
                        "platform_account_id": platform_account_id,
                        "account_name": account.account_name if account else None,
                    },
                )
                for entry in entries[:20]
            ],
            evidence_window=f"{period}:{start_at.isoformat()} 至 {now.isoformat()}" + (f"；店铺={account.account_name}" if account else ""),
            confidence_reason="财务汇总只聚合已入库财务台账，不根据订单金额或成本率补造财务结论；传入店铺时只统计该店铺绑定台账。",
            data_gaps=data_gaps,
        ),
    }


async def get_finance_traceback(db: AsyncSession, user_id: str, period: str = "daily", platform_account_id: str | None = None) -> dict:
    start_at = _period_start(period)
    now = datetime.now(timezone.utc)
    account = await _get_owned_platform_account(db, user_id, platform_account_id) if platform_account_id else None
    filters = [
        FinanceLedgerEntry.user_id == user_id,
        FinanceLedgerEntry.occurred_at >= start_at,
        FinanceLedgerEntry.occurred_at <= now,
    ]
    if platform_account_id:
        filters.append(FinanceLedgerEntry.extra["platform_account_id"].as_string() == platform_account_id)
    result = await db.execute(
        select(FinanceLedgerEntry).where(*filters)
    )
    entries = list(result.scalars().all())
    by_order = _traceback_groups(entries, "order")
    by_product = _traceback_groups(entries, "product")
    by_store = _traceback_groups(entries, "store")
    data_gaps = []
    if not entries:
        data_gaps.append("finance_ledger_entries.store_scope" if platform_account_id else "finance_ledger_entries")
    if entries and not any(entry.order_id for entry in entries):
        data_gaps.append("finance_ledger_entries.order_id")
    if entries and not any(entry.sourcing_item_id for entry in entries):
        data_gaps.append("finance_ledger_entries.sourcing_item_id")
    if entries and not any(entry.entry_type in PLATFORM_BILL_TYPES for entry in entries):
        data_gaps.append("finance_ledger_entries.platform_bill")
    return {
        "period": period,
        "summary": {
            "order_count": len(by_order),
            "product_count": len(by_product),
            "store_count": len(by_store),
            "entry_count": len(entries),
        },
        "by_order": by_order,
        "by_product": by_product,
        "by_store": by_store,
        "data_status": "ready" if entries else "data_required",
        **evidence_payload(
            source_refs=[
                source_ref(
                    "finance_ledger_entry",
                    entry.id,
                    field=entry.entry_type,
                    label=entry.description or entry.entry_type,
                    meta={
                        "route": f"/finance?platform_account_id={platform_account_id}" if platform_account_id else "/finance",
                        "order_id": entry.order_id,
                        "sourcing_item_id": entry.sourcing_item_id,
                        "platform_account_id": platform_account_id,
                        "account_name": account.account_name if account else None,
                    },
                )
                for entry in entries[:20]
            ],
            evidence_window=f"{period}:{start_at.isoformat()} 至 {now.isoformat()}" + (f"；店铺={account.account_name}" if account else ""),
            confidence_reason="财务回溯只按真实财务台账的订单、商品和店铺字段聚合；传入店铺时只回溯该店铺绑定台账；缺平台账单时显示缺口，不用订单金额补造利润。",
            data_gaps=data_gaps,
        ),
    }


def _period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "weekly":
        return now - timedelta(days=7)
    if period == "monthly":
        return now - timedelta(days=30)
    return now - timedelta(days=1)


def _sum_amount(entries: list[FinanceLedgerEntry]) -> float:
    return round(sum(entry.amount_rmb for entry in entries), 2)


def _cost_breakdown(entries: list[FinanceLedgerEntry]) -> dict[str, float]:
    breakdown: dict[str, float] = {}
    for entry in entries:
        breakdown[entry.entry_type] = round(breakdown.get(entry.entry_type, 0) + entry.amount_rmb, 2)
    return breakdown


def _finance_risk_signals(
    *,
    entries: list[FinanceLedgerEntry],
    revenue_entries: list[FinanceLedgerEntry],
    cost_entries: list[FinanceLedgerEntry],
    cost_breakdown: dict[str, float],
    total_revenue: float | None,
    total_cost: float | None,
    net_profit: float | None,
    cash_balance: float | None,
    platform_account_id: str | None,
    future_count: int,
) -> list[dict]:
    """Build reusable finance risk signals from real ledger scope only."""
    signals: list[dict] = []
    scoped_suffix = f"&platform_account_id={platform_account_id}" if platform_account_id else ""

    def add_signal(
        code: str,
        level: str,
        title: str,
        detail: str,
        action_label: str,
        entry_type: str,
    ) -> None:
        signals.append({
            "code": code,
            "level": level,
            "title": title,
            "detail": detail,
            "action_label": action_label,
            "action_route": f"/finance?entry_type={entry_type}{scoped_suffix}#finance-ledger",
        })

    if not entries or (entries and not revenue_entries):
        add_signal(
            "revenue_missing",
            "medium",
            "收入台账未入账",
            "当前筛选范围没有销售收入台账记录，无法形成经营收入口径。",
            "补录销售收入",
            "sales_income",
        )
    if entries and total_cost is None:
        add_signal(
            "cost_missing",
            "medium",
            "成本台账不完整",
            "当前筛选范围没有可汇总成本，净利润无法计算。",
            "补录采购或物流成本",
            "purchase_cost",
        )
    if entries and not cost_breakdown.get("purchase_cost"):
        add_signal(
            "purchase_cost_missing",
            "info",
            "采购成本缺失",
            "采购付款尚未形成采购成本台账，商品利润会被高估。",
            "补录采购成本",
            "purchase_cost",
        )
    if entries and not any(entry.entry_type in {"platform_fee", "transaction_fee", "service_fee"} for entry in cost_entries):
        add_signal(
            "platform_bill_missing",
            "info",
            "平台费缺失",
            "平台佣金、交易费或服务费尚未形成平台费用台账。",
            "导入平台账单",
            "platform_fee",
        )
    if cash_balance is None:
        add_signal(
            "cash_balance_missing",
            "info",
            "资金余额未录入",
            "没有可用资金余额台账，无法判断采购安全线和回款压力。",
            "补录资金余额",
            "cash_balance",
        )
    if net_profit is not None and net_profit < 0:
        add_signal(
            "negative_profit",
            "high",
            "净利润为负",
            f"当前筛选范围收入 {total_revenue or 0:.2f} 元、成本 {total_cost or 0:.2f} 元，净利润为 {net_profit:.2f} 元。",
            "复核成本与定价",
            "platform_fee",
        )
    if future_count:
        add_signal(
            "future_entries_excluded",
            "info",
            "未来日期台账未计入",
            f"{future_count} 条未来发生日期台账未计入当前筛选日期范围。",
            "复核发生日期",
            "finance_ledger_entries",
        )
    return signals


def _platform_settlement(entries: list[FinanceLedgerEntry]) -> dict:
    wallet_balances = [
        {
            "platform": entry.platform,
            "market": entry.market,
            "amount_rmb": round(entry.amount_rmb, 2),
            "amount_original": entry.amount_original,
            "currency": entry.currency,
            "account_name": (entry.extra or {}).get("account_name"),
            "reference_rate": (entry.extra or {}).get("reference_rate"),
            "source_entry_id": entry.id,
            "occurred_at": entry.occurred_at.isoformat() if entry.occurred_at else None,
        }
        for entry in entries
        if entry.entry_type == PLATFORM_WALLET_BALANCE_TYPE
    ]
    movement_totals = {
        entry_type: _sum_amount([entry for entry in entries if entry.entry_type == entry_type])
        for entry_type in SETTLEMENT_MOVEMENT_TYPES
    }
    linked_entries = [entry for entry in entries if entry.order_id]
    return {
        "wallet_balances": wallet_balances,
        "movement_totals": movement_totals,
        "order_reconciliation": {
            "linked_order_count": len({entry.order_id for entry in linked_entries if entry.order_id}),
            "linked_entry_count": len(linked_entries),
        },
    }


def _traceback_groups(entries: list[FinanceLedgerEntry], group_by: str) -> list[dict]:
    grouped: dict[str, list[FinanceLedgerEntry]] = {}
    for entry in entries:
        key = _traceback_key(entry, group_by)
        if not key:
            continue
        grouped.setdefault(key, []).append(entry)
    rows = [_traceback_row(group_by, key, group_entries) for key, group_entries in grouped.items()]
    return sorted(rows, key=lambda item: (item["net_profit_rmb"] is None, -(item["revenue_rmb"] or 0), item.get("order_id") or item.get("product_id") or item.get("store_key") or ""))


def _traceback_key(entry: FinanceLedgerEntry, group_by: str) -> str:
    if group_by == "order":
        return entry.order_id or ""
    if group_by == "product":
        return entry.sourcing_item_id or (entry.extra or {}).get("product_id") or ""
    if group_by == "store":
        extra = entry.extra or {}
        return extra.get("platform_account_id") or "|".join([
            entry.platform or "",
            entry.market or "",
            extra.get("account_name") or "",
        ])
    return ""


def _traceback_row(group_by: str, key: str, entries: list[FinanceLedgerEntry]) -> dict:
    revenue_entries = [entry for entry in entries if entry.entry_type in REVENUE_TYPES]
    cost_entries = [
        entry for entry in entries
        if entry.entry_type not in REVENUE_TYPES and entry.entry_type not in NON_PROFIT_LOSS_TYPES
    ]
    revenue = _sum_amount(revenue_entries) if revenue_entries else None
    cost = _sum_amount(cost_entries) if cost_entries else None
    has_platform_bill = any(entry.entry_type in PLATFORM_BILL_TYPES for entry in entries)
    data_gaps = []
    if revenue is None:
        data_gaps.append("revenue")
    if cost is None:
        data_gaps.append("cost")
    if group_by == "order" and not has_platform_bill:
        data_gaps.append("platform_bill")
    net_profit = round(revenue - cost, 2) if revenue is not None and cost is not None and not data_gaps else None
    first = entries[0]
    extra = first.extra or {}
    row = {
        "revenue_rmb": revenue,
        "cost_rmb": cost,
        "net_profit_rmb": net_profit,
        "cost_breakdown": _cost_breakdown(cost_entries),
        "entry_count": len(entries),
        "source_entry_ids": [entry.id for entry in entries],
        "data_gaps": list(dict.fromkeys(data_gaps)),
    }
    if group_by == "order":
        row.update({
            "order_id": key,
            "platform": first.platform,
            "market": first.market,
            "account_name": extra.get("account_name"),
        })
    elif group_by == "product":
        product_name = next(((entry.extra or {}).get("product_name") for entry in entries if (entry.extra or {}).get("product_name")), None)
        row.update({
            "product_id": key,
            "product_name": product_name or key,
            "platform": first.platform,
            "market": first.market,
        })
    elif group_by == "store":
        row.update({
            "store_key": key,
            "platform": first.platform,
            "market": first.market,
            "account_name": extra.get("account_name"),
        })
    return row


async def _latest_cash_balance(
    db: AsyncSession,
    user_id: str,
    platform_account_id: str | None = None,
    as_at: datetime | None = None,
) -> Optional[float]:
    filters = [
        FinanceLedgerEntry.user_id == user_id,
        FinanceLedgerEntry.entry_type == CASH_BALANCE_TYPE,
    ]
    if platform_account_id:
        filters.append(FinanceLedgerEntry.extra["platform_account_id"].as_string() == platform_account_id)
    if as_at:
        filters.append(FinanceLedgerEntry.occurred_at <= as_at)
    result = await db.execute(
        select(FinanceLedgerEntry.amount_rmb)
        .where(*filters)
        .order_by(FinanceLedgerEntry.occurred_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()

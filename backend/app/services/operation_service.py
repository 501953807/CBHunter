"""Operating records with dictionary validation and finance ledger synchronization."""

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance_ledger import FinanceLedgerEntry
from app.models.operation_record import OperationRecord
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.sys_dict import SysDictItem
from app.services.evidence_service import source_ref

TEMPORARY_NAME_PATTERNS = (
    "修改后的",
    "仅名称无其他必填",
    "自动化测试",
)


async def get_options(db: AsyncSession) -> dict:
    result = await db.execute(
        select(SysDictItem).where(
            SysDictItem.type.in_(["operation_record_type", "operation_record_status"]),
            SysDictItem.is_active.is_(True),
        ).order_by(SysDictItem.type, SysDictItem.sort_order)
    )
    options = {"record_types": [], "statuses": []}
    for item in result.scalars().all():
        target = "record_types" if item.type == "operation_record_type" else "statuses"
        options[target].append({"id": item.id, "label": item.label, **(item.extra or {})})
    return options


async def list_records(
    db: AsyncSession,
    user_id: str,
    page: int,
    page_size: int,
    record_type: Optional[str] = None,
    status: Optional[str] = None,
) -> tuple[list[OperationRecord], int]:
    conditions = [OperationRecord.user_id == user_id]
    if record_type:
        conditions.append(OperationRecord.record_type == record_type)
    if status:
        conditions.append(OperationRecord.status == status)
    total = (await db.execute(select(func.count(OperationRecord.id)).where(*conditions))).scalar() or 0
    result = await db.execute(
        select(OperationRecord).where(*conditions).order_by(OperationRecord.updated_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), total


async def create_record(db: AsyncSession, user_id: str, data: dict) -> OperationRecord:
    _validate_required_fields(data)
    await _validate_options(db, data["record_type"], data["status"])
    record = OperationRecord(user_id=user_id, **data)
    db.add(record)
    await db.flush()
    await _sync_ledger(db, record)
    await db.commit()
    await db.refresh(record)
    return record


async def update_record(db: AsyncSession, user_id: str, record_id: str, data: dict) -> OperationRecord:
    record = await get_record(db, user_id, record_id)
    record_type = data.get("record_type", record.record_type)
    status = data.get("status", record.status)
    await _validate_options(db, record_type, status)
    _validate_required_fields({
        "name": data.get("name", record.name),
        "counterparty": data.get("counterparty", record.counterparty),
        "planned_amount_rmb": data.get("planned_amount_rmb", record.planned_amount_rmb),
    })
    for key, value in data.items():
        setattr(record, key, value)
    await _sync_ledger(db, record)
    await db.commit()
    await db.refresh(record)
    return record


async def delete_record(db: AsyncSession, user_id: str, record_id: str) -> None:
    record = await get_record(db, user_id, record_id)
    if record.ledger_entry_id:
        ledger = await db.get(FinanceLedgerEntry, record.ledger_entry_id)
        if ledger and ledger.user_id == user_id:
            await db.delete(ledger)
    await db.delete(record)
    await db.commit()


async def get_record(db: AsyncSession, user_id: str, record_id: str) -> OperationRecord:
    result = await db.execute(
        select(OperationRecord).where(OperationRecord.id == record_id, OperationRecord.user_id == user_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="运营记录不存在")
    return record


async def get_summary(db: AsyncSession, user_id: str) -> dict:
    result = await db.execute(select(OperationRecord).where(OperationRecord.user_id == user_id))
    records = list(result.scalars().all())
    by_type: dict[str, dict] = {}
    for record in records:
        item = by_type.setdefault(record.record_type, {"count": 0, "planned_amount_rmb": 0.0, "actual_amount_rmb": 0.0})
        item["count"] += 1
        item["planned_amount_rmb"] += record.planned_amount_rmb or 0
        item["actual_amount_rmb"] += record.actual_amount_rmb or 0
    for item in by_type.values():
        item["planned_amount_rmb"] = round(item["planned_amount_rmb"], 2)
        item["actual_amount_rmb"] = round(item["actual_amount_rmb"], 2)
    return {"total": len(records), "by_type": by_type, "data_status": "ready" if records else "empty"}


async def get_product_operation_metrics(db: AsyncSession, user_id: str) -> dict:
    result = await db.execute(
        select(PlatformListing, Product, PlatformAccount)
        .join(Product, PlatformListing.product_id == Product.id)
        .join(PlatformAccount, PlatformListing.platform_account_id == PlatformAccount.id)
        .where(PlatformListing.user_id == user_id)
        .order_by(PlatformListing.updated_at.desc())
    )
    rows = list(result.all())
    operation_records = await _product_operation_records_by_listing(db, user_id)
    items = [
        _build_product_metric_item(listing, product, account, operation_records.get(listing.id, []))
        for listing, product, account in rows
    ]
    data_gaps = []
    if not rows:
        data_gaps.append("暂无平台 Listing，无法形成商品运营指标")
    if rows and any(item["data_gaps"] for item in items):
        data_gaps.append("部分 Listing 缺少平台经营指标，请通过 Open API 或卖家后台导入补齐")
    reviewed_action_count = sum(1 for records in operation_records.values() for record in records if _is_reviewed_operation(record))
    pending_action_count = sum(1 for records in operation_records.values() for record in records if not _is_reviewed_operation(record))
    return {
        "summary": {
            "listing_count": len(items),
            "diagnostic_count": sum(len(item["diagnostics"]) for item in items),
            "action_count": sum(len(item["growth_actions"]) for item in items),
            "reviewed_action_count": reviewed_action_count,
            "pending_action_count": pending_action_count,
        },
        "items": items,
        "data_status": "ready" if items else "data_required",
        "source_refs": [source_ref("platform_listing", item["listing_id"], label=item["listing_title"]) for item in items],
        "evidence_window": "近30天商品 Listing 运营指标",
        "confidence_reason": "商品运营指标仅来自本地 Listing 已同步或导入的 performance 字段；缺平台 Open API 指标时只提示缺口，不生成确定性增长结论。",
        "data_gaps": data_gaps,
    }


async def create_product_diagnostic_action(
    db: AsyncSession,
    user_id: str,
    listing_id: str,
    diagnostic_code: str,
) -> OperationRecord:
    result = await db.execute(
        select(PlatformListing, Product, PlatformAccount)
        .join(Product, PlatformListing.product_id == Product.id)
        .join(PlatformAccount, PlatformListing.platform_account_id == PlatformAccount.id)
        .where(PlatformListing.id == listing_id, PlatformListing.user_id == user_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Listing 不存在或无权访问")
    listing, product, account = row
    metric_item = _build_product_metric_item(listing, product, account, [])
    diagnostic = next((item for item in metric_item["diagnostics"] if item["code"] == diagnostic_code), None)
    if not diagnostic:
        raise HTTPException(status_code=400, detail="诊断编码不属于当前 Listing")
    return await create_record(db, user_id, {
        "record_type": "listing_optimization",
        "status": "operation_pending",
        "name": f"Listing优化：{product.name} - {diagnostic['title']}",
        "platform": account.platform,
        "market": (account.settings or {}).get("market"),
        "counterparty": account.account_name,
        "planned_amount_rmb": 0,
        "actual_amount_rmb": None,
        "currency": "CNY",
        "notes": diagnostic["detail"],
        "metrics": {
            "diagnostic_code": diagnostic_code,
            "diagnostic_title": diagnostic["title"],
            **metric_item["metrics"],
        },
        "extra": {
            "source": "product_operation_metric",
            "listing_id": listing.id,
            "product_id": product.id,
            "platform_account_id": account.id,
        },
    })


def _build_product_metric_item(
    listing: PlatformListing,
    product: Product,
    account: PlatformAccount,
    operation_records: list[OperationRecord],
) -> dict:
    performance = listing.performance or {}
    impressions = _metric_number(performance, "impressions_30d")
    views = _metric_number(performance, "views_30d")
    orders = _metric_number(performance, "orders_30d")
    sales = _metric_number(performance, "sales_amount_30d")
    favorites = _metric_number(performance, "favorites_30d")
    rating = _metric_number(performance, "rating")
    reviews = _metric_number(performance, "reviews_30d")
    conversion = round((orders / views) * 100, 2) if views and orders is not None else None
    metrics = {
        "impressions_30d": impressions,
        "views_30d": views,
        "orders_30d": orders,
        "sales_amount_30d": sales,
        "conversion_rate_pct": conversion,
        "favorites_30d": favorites,
        "rating": rating,
        "reviews_30d": reviews,
        "stock": listing.stock,
    }
    data_gaps = [
        key for key, value in metrics.items()
        if key != "stock" and value is None
    ]
    diagnostics = _listing_diagnostics(metrics, listing)
    return {
        "listing_id": listing.id,
        "product_id": product.id,
        "product_name": product.name,
        "sku": product.sku,
        "listing_title": listing.title,
        "platform": account.platform,
        "account_name": account.account_name,
        "market": (account.settings or {}).get("market"),
        "status": listing.status,
        "metrics": metrics,
        "diagnostics": diagnostics,
        "growth_actions": _growth_actions(product.id, listing.id, diagnostics),
        "operation_feedback": _operation_feedback(operation_records),
        "data_gaps": data_gaps,
    }


async def _product_operation_records_by_listing(db: AsyncSession, user_id: str) -> dict[str, list[OperationRecord]]:
    result = await db.execute(
        select(OperationRecord)
        .where(OperationRecord.user_id == user_id)
        .order_by(OperationRecord.updated_at.desc())
    )
    by_listing: dict[str, list[OperationRecord]] = {}
    for record in result.scalars().all():
        extra = record.extra or {}
        if extra.get("source") != "product_operation_metric":
            continue
        listing_id = extra.get("listing_id")
        if not isinstance(listing_id, str) or not listing_id:
            continue
        by_listing.setdefault(listing_id, []).append(record)
    return by_listing


def _operation_feedback(records: list[OperationRecord]) -> dict:
    if not records:
        return {
            "has_review": False,
            "record_id": None,
            "record_name": None,
            "status": None,
            "completed_at": None,
            "review_result": None,
            "effect_summary": None,
            "pending_count": 0,
            "reviewed_count": 0,
        }
    reviewed_records = [record for record in records if _is_reviewed_operation(record)]
    latest = reviewed_records[0] if reviewed_records else records[0]
    metrics = latest.metrics or {}
    extra = latest.extra or {}
    completed_at = latest.completed_at.isoformat() if latest.completed_at else None
    return {
        "has_review": bool(reviewed_records),
        "record_id": latest.id,
        "record_name": latest.name,
        "status": latest.status,
        "completed_at": completed_at,
        "review_result": metrics.get("review_result") or latest.notes,
        "effect_summary": extra.get("effect_summary") or metrics.get("effect_summary"),
        "pending_count": sum(1 for record in records if not _is_reviewed_operation(record)),
        "reviewed_count": len(reviewed_records),
    }


def _is_reviewed_operation(record: OperationRecord) -> bool:
    metrics = record.metrics or {}
    extra = record.extra or {}
    return bool(
        record.completed_at
        or record.status in {"operation_completed", "completed", "done", "closed"}
        or metrics.get("review_result")
        or extra.get("effect_summary")
    )


def _metric_number(performance: dict, key: str):
    value = performance.get(key)
    return round(float(value), 2) if isinstance(value, (int, float)) else None


def _listing_diagnostics(metrics: dict, listing: PlatformListing) -> list[dict]:
    diagnostics = []
    if metrics["views_30d"] and metrics["orders_30d"] == 0:
        diagnostics.append({
            "code": "traffic_no_order",
            "level": "warning",
            "title": "有浏览无订单",
            "detail": "近30天已有浏览但没有订单，优先检查标题卖点、主图、价格和平台字段完整性。",
        })
    if metrics["conversion_rate_pct"] is not None and 0 < metrics["conversion_rate_pct"] < 1:
        diagnostics.append({
            "code": "low_conversion",
            "level": "warning",
            "title": "转化率偏低",
            "detail": "转化率低于 1%，应复核价格、评价、详情页卖点和竞品差异。",
        })
    if listing.stock <= 5 and (metrics["orders_30d"] or 0) > 0:
        diagnostics.append({
            "code": "stock_risk",
            "level": "critical",
            "title": "库存临界",
            "detail": "近30天已有订单且库存低，需复核补货和发货风险。",
        })
    if not diagnostics:
        diagnostics.append({
            "code": "monitor",
            "level": "info",
            "title": "持续观察",
            "detail": "当前指标未触发明确诊断，继续观察曝光、点击、转化和评价变化。",
        })
    return diagnostics


def _growth_actions(product_id: str, listing_id: str, diagnostics: list[dict]) -> list[dict]:
    codes = {item["code"] for item in diagnostics}
    actions = []
    if "traffic_no_order" in codes or "low_conversion" in codes:
        actions.extend([
            {"label": "优化 Listing 内容", "route": f"/content?product_id={product_id}", "reason": "先调整标题、卖点、主图和详情页内容。"},
            {"label": "复核定价", "route": f"/smart/pricing?listing_id={listing_id}", "reason": "结合竞品和成本重新测算售价。"},
        ])
    if "stock_risk" in codes:
        actions.append({"label": "处理库存风险", "route": "/inventory-alerts", "reason": "补货或调整可售库存，避免超卖和履约逾期。"})
    if not actions:
        actions.append({"label": "进入运营台账复盘", "route": "/operations", "reason": "保留观察记录，等待下一轮指标变化。"})
    return actions


async def _validate_options(db: AsyncSession, record_type: str, status: str) -> None:
    result = await db.execute(
        select(SysDictItem.type, SysDictItem.id).where(
            SysDictItem.id.in_([record_type, status]),
            SysDictItem.is_active.is_(True),
        )
    )
    found = {(row.type, row.id) for row in result.all()}
    if ("operation_record_type", record_type) not in found:
        raise HTTPException(status_code=400, detail="运营类型不在统一字典中")
    if ("operation_record_status", status) not in found:
        raise HTTPException(status_code=400, detail="运营状态不在统一字典中")


def _validate_required_fields(data: dict) -> None:
    name = str(data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="记录名称不能为空")
    _validate_record_name(name)
    if not str(data.get("counterparty") or "").strip():
        raise HTTPException(status_code=400, detail="合作方/回款方不能为空")
    planned = data.get("planned_amount_rmb")
    if planned is None or planned < 0:
        raise HTTPException(status_code=400, detail="计划金额必须大于等于 0")


def _validate_record_name(name: str) -> None:
    normalized = name.strip()
    is_temporary = normalized.endswith("-测试") or any(pattern in normalized for pattern in TEMPORARY_NAME_PATTERNS)
    if is_temporary:
        raise HTTPException(status_code=400, detail="记录名称疑似临时编辑或测试残留，请填写真实业务名称")


async def _sync_ledger(db: AsyncSession, record: OperationRecord) -> None:
    type_result = await db.execute(
        select(SysDictItem).where(
            SysDictItem.id == record.record_type,
            SysDictItem.type == "operation_record_type",
        )
    )
    type_item = type_result.scalar_one()
    ledger_entry_type = (type_item.extra or {}).get("ledger_entry_type")
    actual = record.actual_amount_rmb
    ledger = await db.get(FinanceLedgerEntry, record.ledger_entry_id) if record.ledger_entry_id else None
    if not ledger_entry_type or actual is None or actual <= 0:
        if ledger:
            await db.delete(ledger)
            record.ledger_entry_id = None
        return
    description = f"{type_item.label}: {record.name}"
    extra = {"source": "operation_record", "operation_record_id": record.id}
    if ledger:
        ledger.entry_type = ledger_entry_type
        ledger.amount_rmb = actual
        ledger.currency = record.currency
        ledger.platform = record.platform
        ledger.market = record.market
        ledger.description = description
        ledger.extra = extra
        return
    ledger = FinanceLedgerEntry(
        user_id=record.user_id,
        entry_type=ledger_entry_type,
        amount_rmb=actual,
        currency=record.currency,
        platform=record.platform,
        market=record.market,
        description=description,
        extra=extra,
    )
    db.add(ledger)
    await db.flush()
    record.ledger_entry_id = ledger.id

"""Inventory alerts API — rules management + alert history."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.inventory_alert import InventoryAlertRule, InventoryAlertLog
from app.models.user import User
from app.schemas.common import ApiResponse, PaginationMeta
from app.api.v1.response_helpers import evidence_response
from app.schemas.inventory_alert import (
    InventoryAlertRuleCreate,
    InventoryAlertRuleUpdate,
    InventoryAlertRuleResponse,
    InventoryAlertLogResponse,
)
from app.schemas.operations import OperationRecordResponse
from app.services import inventory_alert_service
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import data_required, evidence_payload, source_ref
from app.services.inventory_risk_action_service import create_operation_record_from_inventory_slow_moving

router = APIRouter(prefix="/inventory-alerts", tags=["inventory-alerts"])


@router.get("/rules", response_model=ApiResponse)
async def list_rules(
    product_id: Optional[str] = Query(None),
    enabled: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await inventory_alert_service.list_rules(db, current_user.id, product_id, enabled)
    return ApiResponse(
        data=[InventoryAlertRuleResponse.model_validate(item) for item in items],
        status="ready" if items else "data_required",
        source_refs=[source_ref("inventory_alert_rule", item.id, label=item.sku) for item in items],
        evidence_window="当前库存预警规则配置",
        confidence_reason="规则列表只读取当前用户创建的库存阈值规则。",
        data_gaps=[] if items else ["尚未配置库存预警规则"],
    )


@router.post("/rules", response_model=ApiResponse)
async def create_rule(
    req: InventoryAlertRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _validate_inventory_alert_options(db, severity=req.severity)
    rule = await inventory_alert_service.create_rule(
        db, current_user.id, req.product_id, req.sku,
        req.product_name, req.safety_stock, req.severity,
    )
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="inventory_alert_rule",
        resource_id=rule.id,
        new_value=_rule_snapshot(rule),
        detail="创建库存预警规则",
    )
    return ApiResponse(data=InventoryAlertRuleResponse.model_validate(rule))


@router.put("/rules/{rule_id}", response_model=ApiResponse)
async def update_rule(
    rule_id: str,
    req: InventoryAlertRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kwargs = {k: v for k, v in req.model_dump().items() if v is not None}
    if "severity" in kwargs:
        await _validate_inventory_alert_options(db, severity=kwargs["severity"])
    old_rule = await _get_rule(db, rule_id, current_user.id)
    if not old_rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    old_value = _rule_snapshot(old_rule)
    rule = await inventory_alert_service.update_rule(db, rule_id, current_user.id, **kwargs)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="inventory_alert_rule",
        resource_id=rule.id,
        old_value=old_value,
        new_value=_rule_snapshot(rule),
        detail="更新库存预警规则",
    )
    return ApiResponse(data=InventoryAlertRuleResponse.model_validate(rule))


@router.delete("/rules/{rule_id}", response_model=ApiResponse)
async def delete_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_rule(db, rule_id, current_user.id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    old_value = _rule_snapshot(rule)
    ok = await inventory_alert_service.delete_rule(db, rule_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="规则不存在")
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="inventory_alert_rule",
        resource_id=rule_id,
        old_value=old_value,
        detail="删除库存预警规则",
    )
    return ApiResponse(data={"deleted": True})


@router.post("/check", response_model=ApiResponse)
async def check_inventory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run inventory scan against all enabled rules."""
    result = await inventory_alert_service.check_inventory(db, current_user.id)
    gaps = []
    if result["rules_checked"] == 0:
        gaps.append("inventory_alert_rules")
    if result["rules_skipped_no_confirmed_stock"] > 0:
        gaps.append("platform_listings.confirmed_stock")
    missing = data_required(
        "库存扫描缺少预警规则或已确认库存记录",
        data_gaps=gaps,
        evidence_window="当前库存预警规则与在售 Listing 快照",
    ) if gaps else {}
    return evidence_response({
        "checked": not bool(gaps),
        "new_alerts": len(result["alerts"]),
        "rules_checked": result["rules_checked"],
        "rules_skipped_no_confirmed_stock": result["rules_skipped_no_confirmed_stock"],
        **evidence_payload(
            source_refs=[
                source_ref("inventory_alert_log", item.id, fields=["current_stock", "threshold", "severity"])
                for item in result["alerts"][:20]
            ],
            evidence_window="当前库存预警规则与在售 Listing 快照",
            confidence_reason="只扫描已启用规则和可访问店铺中已确认库存的在售 Listing；库存未知时不生成预警。",
            data_gaps=gaps,
        ),
        **missing,
    })


@router.get("/logs", response_model=ApiResponse)
async def list_alerts(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _validate_inventory_alert_options(db, status=status, severity=severity)
    offset = (page - 1) * page_size
    items, total = await inventory_alert_service.list_alerts(
        db, current_user.id, status, severity, page_size, offset,
    )
    data = [InventoryAlertLogResponse.model_validate(item) for item in items]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return ApiResponse(
        data=data,
        meta=PaginationMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
        status="ready" if total else "data_required",
        source_refs=[source_ref("inventory_alert_log", item.id, label=item.sku) for item in items],
        evidence_window="当前库存预警历史",
        confidence_reason="预警历史由启用规则与已确认库存 Listing 比较后产生；未知库存不会生成预警。",
        data_gaps=[] if total else ["当前筛选范围没有库存预警事件"],
    )


@router.put("/logs/{alert_id}/acknowledge", response_model=ApiResponse)
async def acknowledge_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    old_log = await _get_alert_log(db, alert_id, current_user.id)
    if not old_log:
        raise HTTPException(status_code=404, detail="预警不存在或已处理")
    old_value = _alert_snapshot(old_log)
    log = await inventory_alert_service.acknowledge_alert(db, alert_id, current_user.id, current_user.username)
    if not log:
        raise HTTPException(status_code=404, detail="预警不存在或已处理")
    await record_audit_event(
        db,
        user=current_user,
        action="acknowledge",
        resource_type="inventory_alert_log",
        resource_id=alert_id,
        old_value=old_value,
        new_value=_alert_snapshot(log),
        detail="确认库存预警",
    )
    return ApiResponse(data=InventoryAlertLogResponse.model_validate(log))


@router.put("/logs/{alert_id}/clear", response_model=ApiResponse)
async def clear_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    old_log = await _get_alert_log(db, alert_id, current_user.id)
    if not old_log:
        raise HTTPException(status_code=404, detail="预警不存在或已清除")
    old_value = _alert_snapshot(old_log)
    log = await inventory_alert_service.clear_alert(db, alert_id, current_user.id)
    if not log:
        raise HTTPException(status_code=404, detail="预警不存在或已清除")
    await record_audit_event(
        db,
        user=current_user,
        action="clear",
        resource_type="inventory_alert_log",
        resource_id=alert_id,
        old_value=old_value,
        new_value=_alert_snapshot(log),
        detail="清除库存预警",
    )
    return ApiResponse(data=InventoryAlertLogResponse.model_validate(log))


@router.get("/stats", response_model=ApiResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await inventory_alert_service.get_alert_stats(db, current_user.id)
    return ApiResponse(
        data=stats,
        status="ready" if stats["total_rules"] else "data_required",
        source_refs=[source_ref("inventory_alert_rule", field="enabled", label="启用预警规则")]
        if stats["total_rules"] else [],
        evidence_window="当前规则与未处理预警快照",
        confidence_reason="统计直接聚合当前用户启用规则和真实预警事件。",
        data_gaps=[] if stats["total_rules"] else ["尚未配置库存预警规则"],
    )


@router.get("/risk-workbench", response_model=ApiResponse)
async def get_risk_workbench(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workbench = await inventory_alert_service.get_inventory_risk_workbench(db, current_user.id)
    source_refs = [
        source_ref("inventory_alert_log", item["alert_id"], label=item["sku"])
        for item in workbench["stockout"]["items"][:20]
    ]
    source_refs.extend(
        source_ref("platform_listing", item["listing_id"], label=item["sku"])
        for item in workbench["capital"]["items"][:20]
    )
    source_refs.extend(
        source_ref("order", item["order_id"], label=item["order_number"])
        for item in workbench["fulfillment_overdue"]["items"][:20]
    )
    has_signal = any((
        workbench["stockout"]["count"],
        workbench["capital"]["items"],
        workbench["slow_moving"]["count"],
        workbench["fulfillment_overdue"]["count"],
    ))
    return ApiResponse(
        data=workbench,
        status="ready" if has_signal else "data_required",
        source_refs=source_refs,
        evidence_window="当前可访问店铺的库存预警、在售 Listing 和未完成订单快照",
        confidence_reason="库存资金只按已确认库存和商品成本价计算；滞销只按 Listing 30 天浏览/订单判断；发货风险只按平台发货时限判断。",
        data_gaps=workbench["data_gaps"] or ([] if has_signal else ["库存预警、成本、运营或履约数据不足"]),
    )


@router.post("/risk-workbench/slow-moving/{listing_id}/operation-action", response_model=ApiResponse, status_code=201)
async def create_slow_moving_operation_action(
    listing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await create_operation_record_from_inventory_slow_moving(db, current_user.id, listing_id)
    await record_audit_event(
        db,
        user=current_user,
        action="create_inventory_risk_operation_action",
        resource_type="operation_record",
        resource_id=record.id,
        new_value=_operation_snapshot(record),
        detail=f"库存风险工作台生成运营台账动作：{listing_id}",
    )
    return ApiResponse(data=OperationRecordResponse.model_validate(record))


async def _get_rule(db: AsyncSession, rule_id: str, user_id: str) -> Optional[InventoryAlertRule]:
    result = await db.execute(
        select(InventoryAlertRule).where(
            InventoryAlertRule.id == rule_id,
            InventoryAlertRule.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _validate_inventory_alert_options(
    db: AsyncSession,
    *,
    severity: Optional[str] = None,
    status: Optional[str] = None,
) -> None:
    config = await config_service.get_all_config(db)
    if severity:
        allowed = {item["id"] for item in config.get("inventory_alert_severities", [])}
        if severity not in allowed:
            raise HTTPException(status_code=400, detail="库存预警级别不在运行时字典中")
    if status:
        allowed = {item["id"] for item in config.get("inventory_alert_statuses", [])}
        if status not in allowed:
            raise HTTPException(status_code=400, detail="库存预警状态不在运行时字典中")


async def _get_alert_log(db: AsyncSession, alert_id: str, user_id: str) -> Optional[InventoryAlertLog]:
    result = await db.execute(
        select(InventoryAlertLog).where(
            InventoryAlertLog.id == alert_id,
            InventoryAlertLog.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def _rule_snapshot(rule: InventoryAlertRule) -> dict:
    return {
        "id": rule.id,
        "product_id": rule.product_id,
        "sku": rule.sku,
        "product_name": rule.product_name,
        "safety_stock": rule.safety_stock,
        "severity": rule.severity,
        "enabled": rule.enabled,
    }


def _alert_snapshot(log: InventoryAlertLog) -> dict:
    return {
        "id": log.id,
        "rule_id": log.rule_id,
        "product_id": log.product_id,
        "sku": log.sku,
        "product_name": log.product_name,
        "current_stock": log.current_stock,
        "threshold": log.threshold,
        "severity": log.severity,
        "status": log.status,
    }


def _operation_snapshot(record) -> dict:
    return {
        "id": record.id,
        "record_type": record.record_type,
        "status": record.status,
        "name": record.name,
        "platform": record.platform,
        "market": record.market,
        "counterparty": record.counterparty,
        "extra": record.extra,
    }

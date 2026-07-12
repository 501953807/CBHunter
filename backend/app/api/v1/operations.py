"""Independent operating records API."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse, PaginationMeta
from app.schemas.operations import ProductDiagnosticActionCreate, OperationRecordCreate, OperationRecordResponse, OperationRecordUpdate
from app.services import operation_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("/options", response_model=ApiResponse)
async def operation_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await operation_service.get_options(db))


@router.get("/summary", response_model=ApiResponse)
async def operation_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    summary = await operation_service.get_summary(db, current_user.id)
    return ApiResponse(
        data=summary,
        status="ready" if summary["total"] else "data_required",
        evidence_window="当前用户全部运营台账",
        confidence_reason="汇总金额仅来自已录入的运营记录，未录入真实金额不会按零推断。",
        data_gaps=[] if summary["total"] else ["暂无运营台账记录"],
    )


@router.get("/product-metrics", response_model=ApiResponse)
async def product_operation_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    metrics = await operation_service.get_product_operation_metrics(db, current_user.id)
    return ApiResponse(
        data=metrics,
        status=metrics["data_status"],
        source_refs=metrics["source_refs"],
        evidence_window=metrics["evidence_window"],
        confidence_reason=metrics["confidence_reason"],
        data_gaps=metrics["data_gaps"],
    )


@router.post("/product-actions", response_model=ApiResponse, status_code=201)
async def create_product_operation_action(
    req: ProductDiagnosticActionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await operation_service.create_product_diagnostic_action(
        db,
        current_user.id,
        req.listing_id,
        req.diagnostic_code,
    )
    await record_audit_event(
        db,
        user=current_user,
        action="create_product_operation_action",
        resource_type="operation_record",
        resource_id=record.id,
        new_value=_operation_snapshot(record),
        detail="商品运营诊断生成运营台账动作",
    )
    return ApiResponse(
        data=OperationRecordResponse.model_validate(record),
        status="ready",
        source_refs=[source_ref("operation_record", record.id, label=record.name)],
        evidence_window="商品运营诊断动作创建",
        confidence_reason="运营动作来自当前 Listing 的真实 performance 诊断；0 预算动作不会自动生成财务流水。",
    )


@router.get("", response_model=ApiResponse)
async def list_operation_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    record_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    records, total = await operation_service.list_records(db, current_user.id, page, page_size, record_type, status)
    gaps = [] if total else ["暂无符合当前筛选条件的运营台账记录"]
    if records and any(record.actual_amount_rmb is None for record in records):
        gaps.append("部分记录尚未录入真实发生金额")
    return ApiResponse(
        data=[OperationRecordResponse.model_validate(record) for record in records],
        meta=PaginationMeta(page=page, page_size=page_size, total=total, total_pages=(total + page_size - 1) // page_size),
        status="ready" if total else "data_required",
        source_refs=[source_ref("operation_record", record.id, label=record.name) for record in records],
        evidence_window=f"当前筛选第 {page} 页",
        confidence_reason="运营记录及财务关联状态直接读取当前用户台账。",
        data_gaps=gaps,
    )


@router.post("", response_model=ApiResponse, status_code=201)
async def create_operation_record(
    req: OperationRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await operation_service.create_record(db, current_user.id, req.model_dump())
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="operation_record",
        resource_id=record.id,
        new_value=_operation_snapshot(record),
        detail="创建运营台账记录",
    )
    return ApiResponse(data=OperationRecordResponse.model_validate(record))


@router.put("/{record_id}", response_model=ApiResponse)
async def update_operation_record(
    record_id: str,
    req: OperationRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = req.model_dump(exclude_unset=True)
    existing = await operation_service.get_record(db, current_user.id, record_id)
    old_value = _operation_snapshot(existing)
    record = await operation_service.update_record(db, current_user.id, record_id, data)
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="operation_record",
        resource_id=record.id,
        old_value=old_value,
        new_value=_operation_snapshot(record),
        detail="更新运营台账记录",
    )
    return ApiResponse(data=OperationRecordResponse.model_validate(record))


@router.delete("/{record_id}", response_model=ApiResponse)
async def delete_operation_record(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await operation_service.get_record(db, current_user.id, record_id)
    old_value = _operation_snapshot(record)
    await operation_service.delete_record(db, current_user.id, record_id)
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="operation_record",
        resource_id=record_id,
        old_value=old_value,
        detail="删除运营台账记录并同步移除关联财务流水",
    )
    return ApiResponse(data={"deleted": True, "id": record_id})


def _operation_snapshot(record) -> dict:
    return {
        "id": record.id,
        "record_type": record.record_type,
        "status": record.status,
        "name": record.name,
        "platform": record.platform,
        "market": record.market,
        "counterparty": record.counterparty,
        "planned_amount_rmb": record.planned_amount_rmb,
        "actual_amount_rmb": record.actual_amount_rmb,
        "currency": record.currency,
        "due_at": record.due_at,
        "completed_at": record.completed_at,
        "ledger_entry_id": record.ledger_entry_id,
        "metrics": record.metrics,
        "extra": record.extra,
    }

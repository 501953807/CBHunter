"""Finance ledger API."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse, PaginationMeta
from app.schemas.finance import (
    FinanceLedgerCreate,
    FinanceLedgerResponse,
    FinanceSummaryResponse,
    FinanceTracebackResponse,
    PlatformBillImportRequest,
    PlatformBillImportResponse,
    PlatformBillSyncRequest,
    PlatformBillSyncResponse,
)
from app.services.finance_service import (
    create_ledger_entry,
    get_finance_summary,
    get_finance_traceback,
    import_platform_bill_records,
    list_entry_type_options,
    list_ledger_entries,
    sync_platform_bills_for_account,
)
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/summary", response_model=ApiResponse)
async def finance_summary(
    period: str = Query("daily", pattern=r"^(daily|weekly|monthly)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    summary = await get_finance_summary(db, current_user.id, period)
    return ApiResponse(
        data=FinanceSummaryResponse(**summary),
        status=summary["data_status"],
        source_refs=summary["source_refs"],
        evidence_window=summary["evidence_window"],
        confidence_reason=summary["confidence_reason"],
        data_gaps=summary["data_gaps"],
    )


@router.get("/traceback", response_model=ApiResponse)
async def finance_traceback(
    period: str = Query("daily", pattern=r"^(daily|weekly|monthly)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    traceback = await get_finance_traceback(db, current_user.id, period)
    return ApiResponse(
        data=FinanceTracebackResponse(**traceback),
        status=traceback["data_status"],
        source_refs=traceback["source_refs"],
        evidence_window=traceback["evidence_window"],
        confidence_reason=traceback["confidence_reason"],
        data_gaps=traceback["data_gaps"],
    )


@router.get("/ledger", response_model=ApiResponse)
async def list_finance_ledger(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    entry_type: Optional[str] = None,
    platform_account_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entries, total = await list_ledger_entries(db, current_user.id, page, page_size, entry_type, platform_account_id)
    gaps = [] if total else ["当前筛选下暂无财务流水"]
    if platform_account_id and not total:
        gaps = ["当前店铺暂无财务流水；可先同步或导入平台账单"]
    return ApiResponse(
        data=[FinanceLedgerResponse.model_validate(entry) for entry in entries],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=(total + page_size - 1) // page_size,
        ),
        status="ready" if total else "data_required",
        source_refs=[source_ref("finance_ledger_entry", entry.id, label=entry.entry_type) for entry in entries],
        evidence_window=f"当前筛选第 {page} 页财务流水",
        confidence_reason="流水仅来自当前用户已持久化财务台账，不使用订单金额补造入账记录。",
        data_gaps=gaps,
    )


@router.get("/entry-types", response_model=ApiResponse)
async def list_finance_entry_types(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    options = await list_entry_type_options(db, current_user.id)
    return ApiResponse(data=options)


@router.post("/ledger", response_model=ApiResponse, status_code=201)
async def create_finance_ledger(
    req: FinanceLedgerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = await create_ledger_entry(db, current_user.id, req.model_dump())
    await record_audit_event(
        db,
        user=current_user,
        action="finance_ledger_create",
        resource_type="finance_ledger_entry",
        resource_id=entry.id,
        new_value=FinanceLedgerResponse.model_validate(entry).model_dump(),
        detail="手工新增财务台账",
    )
    return ApiResponse(data=FinanceLedgerResponse.model_validate(entry))


@router.post("/platform-bills/import", response_model=ApiResponse, status_code=201)
async def import_platform_bills(
    req: PlatformBillImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await import_platform_bill_records(
        db,
        current_user.id,
        [record.model_dump() for record in req.records],
    )
    await record_audit_event(
        db,
        user=current_user,
        action="platform_bill_import",
        resource_type="finance_ledger_entry",
        new_value=result,
        detail="批量导入平台账单到财务台账",
    )
    return ApiResponse(
        data=PlatformBillImportResponse(**result),
        status="ready" if result["imported_count"] else "data_required",
        source_refs=[
            source_ref("finance_ledger_entry", entry_id, label="平台账单导入")
            for entry_id in result["imported_entry_ids"]
        ],
        evidence_window="当前平台账单导入批次",
        confidence_reason="仅将卖家后台或平台导出的账单明细落入财务台账；不回写平台订单金额，也不用订单金额推算平台费用。",
        data_gaps=[f"跳过 {item['import_ref'] or '未命名记录'}：{item['reason']}" for item in result["skipped"]],
    )


@router.post("/platform-bills/sync", response_model=ApiResponse)
async def sync_platform_bills(
    req: PlatformBillSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await sync_platform_bills_for_account(
        db,
        current_user.id,
        req.platform_account_id,
        req.start_at,
        req.end_at,
    )
    await record_audit_event(
        db,
        user=current_user,
        action="platform_bill_sync",
        resource_type="sync_log",
        resource_id=result["sync_log_id"],
        new_value=result,
        detail="通过平台 Open API 同步平台账单",
    )
    return ApiResponse(
        data=PlatformBillSyncResponse(**result),
        status="ready" if result["status"] == "success" else "data_required",
        source_refs=[
            source_ref("finance_ledger_entry", entry_id, label="平台账单 API 同步")
            for entry_id in result["import_result"]["imported_entry_ids"]
        ],
        evidence_window="当前平台账单 Open API 同步批次",
        confidence_reason="平台账单同步只在对应平台 Open API 账单适配器真实实现并鉴权通过时入账；未实现或缺凭证时只返回缺口，不生成假流水。",
        data_gaps=result["data_gaps"],
    )

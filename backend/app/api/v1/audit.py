"""Audit log API — query config change history."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.schemas.common import ApiResponse, PaginationMeta
from app.schemas.audit import AuditLogResponse
from app.services import audit_service
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=ApiResponse)
async def list_audit_logs(
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date string"),
    date_to: Optional[str] = Query(None, description="ISO date string"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List audit logs with optional filters. Returns paginated results."""
    from_dt = datetime.fromisoformat(date_from) if date_from else None
    to_dt = datetime.fromisoformat(date_to) if date_to else None

    offset = (page - 1) * page_size
    items, total = await audit_service.query_audit_logs(
        db,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        date_from=from_dt,
        date_to=to_dt,
        limit=page_size,
        offset=offset,
    )

    data = [
        AuditLogResponse(
            id=item.id,
            user_id=item.user_id,
            username=item.username,
            action=item.action,
            resource_type=item.resource_type,
            resource_id=item.resource_id,
            old_value=item.old_value,
            new_value=item.new_value,
            detail=item.detail,
            created_at=item.created_at,
        )
        for item in items
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return ApiResponse(
        data=data,
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
        status="ready" if total else "data_required",
        source_refs=[source_ref("audit_log", item.id, label=f"{item.action}:{item.resource_type}") for item in items],
        evidence_window=f"当前筛选第 {page} 页审计记录",
        confidence_reason="仅管理员可查看全租户结构化审计日志，结果按筛选条件直接读取。",
        data_gaps=[] if total else ["当前筛选下暂无审计记录"],
    )

"""API endpoint for triggering data import from 妙手ERP exports."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.audit_service import record_audit_event
from app.services.import_miaoshou import import_miaoshou_data

router = APIRouter(prefix="/import", tags=["import"])


class MiaoshouImportRequest(BaseModel):
    platform_account_id: str


@router.post("/miaoshou", response_model=ApiResponse)
async def trigger_miaoshou_import(
    req: MiaoshouImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import Miaoshou ERP exports into an existing user-owned platform account."""
    try:
        result = await import_miaoshou_data(db, current_user.id, req.platform_account_id)
    except ValueError as exc:
        await record_audit_event(
            db,
            user=current_user,
            action="import_blocked",
            resource_type="miaoshou_import",
            resource_id=req.platform_account_id,
            new_value={"platform_account_id": req.platform_account_id, "error": str(exc)},
            detail="妙手导入被阻断",
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=current_user,
        action="import",
        resource_type="miaoshou_import",
        resource_id=req.platform_account_id,
        new_value=result,
        detail="执行妙手 ERP 数据导入",
    )
    return ApiResponse(data=result)

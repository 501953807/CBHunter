"""Risk-control API for V2 operating shell."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.api.v1.response_helpers import evidence_response
from app.schemas.common import ApiResponse
from app.schemas.operations import OperationRecordResponse
from app.schemas.risk_control import RiskStateUpdateRequest
from app.services.audit_service import record_audit_event
from app.services.risk_control_action_service import create_operation_record_from_risk
from app.services.risk_control_service import (
    get_risk_control_overview,
    get_risk_event_audit,
    update_risk_event_state,
)

router = APIRouter(prefix="/risk-control", tags=["risk-control"])


@router.get("/overview", response_model=ApiResponse)
async def risk_control_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return evidence_response(await get_risk_control_overview(db, current_user.id))


@router.post("/events/{risk_id}/state", response_model=ApiResponse)
async def update_risk_state(
    risk_id: str,
    request: RiskStateUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await update_risk_event_state(db, current_user, risk_id, request)
    except ValueError as exc:
        if str(exc) == "risk_not_found":
            raise HTTPException(status_code=404, detail="风险事件不存在或当前没有真实来源")
        raise
    return ApiResponse(data=data)


@router.post("/events/{risk_id}/operation-action", response_model=ApiResponse, status_code=201)
async def create_risk_operation_action(
    risk_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await create_operation_record_from_risk(db, current_user.id, risk_id)
    await record_audit_event(
        db,
        user=current_user,
        action="create_risk_operation_action",
        resource_type="operation_record",
        resource_id=record.id,
        new_value=_operation_snapshot(record),
        detail=f"风险事件生成运营台账动作：{risk_id}",
    )
    return ApiResponse(data=OperationRecordResponse.model_validate(record))


@router.get("/events/{risk_id}/audit", response_model=ApiResponse)
async def list_risk_audit(
    risk_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await get_risk_event_audit(db, current_user.id, risk_id))


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

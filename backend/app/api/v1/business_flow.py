"""Business-flow API for V2 operating shell."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.api.v1.response_helpers import evidence_response
from app.schemas.business_flow import (
    BusinessFlowTaskBulkRequest,
    BusinessFlowTaskCommentRequest,
    BusinessFlowTaskCompleteReviewRequest,
)
from app.schemas.common import ApiResponse
from app.services.business_flow_service import get_business_flow_overview
from app.services.business_flow_task_service import (
    add_flow_task_comment,
    bulk_update_flow_tasks,
    complete_flow_task_with_review,
    list_flow_task_assignees,
    list_flow_task_events,
)

router = APIRouter(prefix="/business-flow", tags=["business-flow"])


@router.get("/overview", response_model=ApiResponse)
async def business_flow_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return evidence_response(await get_business_flow_overview(db, current_user.id, current_user))


@router.get("/assignees", response_model=ApiResponse)
async def business_flow_assignees(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await list_flow_task_assignees(db, current_user))


@router.post("/tasks/bulk", response_model=ApiResponse)
async def business_flow_task_bulk(
    request: BusinessFlowTaskBulkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return ApiResponse(data=await bulk_update_flow_tasks(db, current_user, request))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/tasks/{task_id}/events", response_model=ApiResponse)
async def business_flow_task_events(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return ApiResponse(data=await list_flow_task_events(db, current_user, task_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/tasks/{task_id}/comments", response_model=ApiResponse)
async def business_flow_task_comment(
    task_id: str,
    request: BusinessFlowTaskCommentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return ApiResponse(data=await add_flow_task_comment(db, current_user, task_id, request))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/tasks/{task_id}/complete-review", response_model=ApiResponse)
async def business_flow_task_complete_review(
    task_id: str,
    request: BusinessFlowTaskCompleteReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return ApiResponse(data=await complete_flow_task_with_review(db, current_user, task_id, request))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

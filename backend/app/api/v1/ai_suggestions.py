from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.ai_suggestion import AISuggestion
from app.schemas.ai_suggestion import AISuggestionResponse
from app.schemas.common import ApiResponse
from app.ai.engine import AIEngine
from app.services.audit_service import record_audit_event
from app.services.evidence_service import unique_refs

router = APIRouter(prefix="/ai-suggestions", tags=["ai-suggestions"])


@router.get("", response_model=ApiResponse)
async def list_suggestions(
    severity: Optional[str] = Query(None),
    suggestion_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(AISuggestion).where(AISuggestion.user_id == current_user.id)

    if severity:
        query = query.where(AISuggestion.severity == severity)
    if suggestion_type:
        query = query.where(AISuggestion.suggestion_type == suggestion_type)

    query = query.order_by(
        AISuggestion.is_read,
        AISuggestion.severity.desc(),
        AISuggestion.created_at.desc(),
    ).limit(50)

    result = await db.execute(query)
    suggestions = list(result.scalars().all())
    refs = unique_refs([ref for item in suggestions for ref in (item.source_refs or [])])
    gaps = [] if suggestions else ["当前筛选下暂无 AI 建议"]
    if suggestions and any(not item.source_refs for item in suggestions):
        gaps.append("部分历史建议缺少来源引用")
    return ApiResponse(
        data=[AISuggestionResponse.model_validate(s) for s in suggestions],
        status="ready" if suggestions else "data_required",
        source_refs=refs,
        evidence_window="当前用户最近 50 条 AI 建议",
        confidence_reason="建议列表来自已持久化分析结果；采纳只记录决策，不代表自动执行经营动作。",
        data_gaps=gaps,
    )


@router.put("/{suggestion_id}/read", response_model=ApiResponse)
async def mark_read(
    suggestion_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AISuggestion).where(
            AISuggestion.id == suggestion_id,
            AISuggestion.user_id == current_user.id,
        )
    )
    sug = result.scalar_one_or_none()
    if not sug:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    old_value = _suggestion_snapshot(sug)
    sug.is_read = True
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="read",
        resource_type="ai_suggestion",
        resource_id=sug.id,
        old_value=old_value,
        new_value=_suggestion_snapshot(sug),
        detail="标记 AI 建议已读",
    )
    return ApiResponse(data=AISuggestionResponse.model_validate(sug))


@router.put("/{suggestion_id}/apply", response_model=ApiResponse)
async def mark_applied(
    suggestion_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AISuggestion).where(
            AISuggestion.id == suggestion_id,
            AISuggestion.user_id == current_user.id,
        )
    )
    sug = result.scalar_one_or_none()
    if not sug:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    old_value = _suggestion_snapshot(sug)
    sug.is_applied = True
    sug.applied_at = datetime.now(timezone.utc)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="apply",
        resource_type="ai_suggestion",
        resource_id=sug.id,
        old_value=old_value,
        new_value=_suggestion_snapshot(sug),
        detail="采纳 AI 建议",
    )
    return ApiResponse(data=AISuggestionResponse.model_validate(sug))


@router.put("/{suggestion_id}/dismiss", response_model=ApiResponse)
async def dismiss(
    suggestion_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AISuggestion).where(
            AISuggestion.id == suggestion_id,
            AISuggestion.user_id == current_user.id,
        )
    )
    sug = result.scalar_one_or_none()
    if not sug:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    old_value = _suggestion_snapshot(sug)
    sug.is_dismissed = True
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="dismiss",
        resource_type="ai_suggestion",
        resource_id=sug.id,
        old_value=old_value,
        new_value=_suggestion_snapshot(sug),
        detail="忽略 AI 建议",
    )
    return ApiResponse(data=AISuggestionResponse.model_validate(sug))


@router.post("/run", response_model=ApiResponse)
async def run_ai_analysis(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    engine = AIEngine(db)
    created = await engine.run_analysis(current_user.id)
    await record_audit_event(
        db,
        user=current_user,
        action="run",
        resource_type="ai_suggestion",
        resource_id=",".join([item.id for item in created]) or "none",
        new_value={
            "created_count": len(created),
            "suggestion_ids": [item.id for item in created],
        },
        detail="手工运行 AI 建议分析",
    )
    return ApiResponse(
        data=[AISuggestionResponse.model_validate(s) for s in created],
        status="ready" if created else "data_required",
        source_refs=unique_refs([ref for item in created for ref in (item.source_refs or [])]),
        evidence_window="本次 AI 建议分析",
        confidence_reason="仅返回本次基于真实业务数据新生成并持久化的建议。",
        data_gaps=[] if created else ["本次分析未生成可落库建议；请检查业务数据与分析条件"],
    )


def _suggestion_snapshot(suggestion: AISuggestion) -> dict:
    return {
        "id": suggestion.id,
        "suggestion_type": suggestion.suggestion_type,
        "title": suggestion.title,
        "severity": suggestion.severity,
        "confidence": suggestion.confidence,
        "category": suggestion.category,
        "related_entity_type": suggestion.related_entity_type,
        "related_entity_id": suggestion.related_entity_id,
        "source_refs": suggestion.source_refs,
        "evidence_window": suggestion.evidence_window,
        "confidence_reason": suggestion.confidence_reason,
        "is_read": suggestion.is_read,
        "is_applied": suggestion.is_applied,
        "is_dismissed": suggestion.is_dismissed,
        "applied_at": suggestion.applied_at,
    }

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse, TemplatePreviewRequest
from app.schemas.common import ApiResponse
from app.services.template_service import (
    list_templates,
    get_template,
    create_template,
    update_template,
    delete_template,
    preview_template,
)
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=ApiResponse)
async def list_templates_endpoint(
    platform: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    templates = await list_templates(db, current_user.id, platform)
    gaps = [] if templates else ["暂无符合当前平台筛选的 Listing 模板"]
    if any(not (item.template_data or {}).get("title_template") for item in templates):
        gaps.append("部分模板缺少标题模板")
    return ApiResponse(
        data=[TemplateResponse.model_validate(t) for t in templates],
        status="ready" if templates else "data_required",
        source_refs=[source_ref("listing_template", item.id, label=item.name) for item in templates],
        evidence_window="当前用户 Listing 模板配置",
        confidence_reason="模板列表直接读取当前用户已保存配置，不自动生成默认模板。",
        data_gaps=gaps,
    )


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_template_endpoint(
    req: TemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await create_template(db, current_user.id, req)
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="listing_template",
        resource_id=template.id,
        new_value=_template_snapshot(template),
        detail="创建刊登模板",
    )
    return ApiResponse(data=TemplateResponse.model_validate(template))


@router.get("/{template_id}", response_model=ApiResponse)
async def get_template_endpoint(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await get_template(db, template_id, current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return ApiResponse(data=TemplateResponse.model_validate(template))


@router.put("/{template_id}", response_model=ApiResponse)
async def update_template_endpoint(
    template_id: str,
    req: TemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await get_template(db, template_id, current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    old_value = _template_snapshot(template)
    updated = await update_template(db, template, req)
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="listing_template",
        resource_id=updated.id,
        old_value=old_value,
        new_value=_template_snapshot(updated),
        detail="更新刊登模板",
    )
    return ApiResponse(data=TemplateResponse.model_validate(updated))


@router.delete("/{template_id}", response_model=ApiResponse)
async def delete_template_endpoint(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await get_template(db, template_id, current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    old_value = _template_snapshot(template)
    await delete_template(db, template)
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="listing_template",
        resource_id=template_id,
        old_value=old_value,
        detail="删除刊登模板",
    )
    return ApiResponse(data={"message": "Template deleted"})


@router.post("/preview", response_model=ApiResponse)
async def preview_template_endpoint(
    req: TemplatePreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await get_template(db, req.template_id, current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    result = await preview_template(db, template, req.product_id, current_user.id)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    unresolved = _find_unresolved(result.get("resolved_data", {}))
    return ApiResponse(
        data=result,
        status="ready" if not unresolved else "data_required",
        source_refs=[
            source_ref("listing_template", template.id, label=template.name),
            source_ref("product", req.product_id, label=result.get("product_name")),
        ],
        evidence_window="当前模板与所选商品主数据快照",
        confidence_reason="预览仅使用已保存模板和当前用户所选真实商品字段替换变量。",
        data_gaps=[f"未解析模板变量: {item}" for item in unresolved],
    )


def _find_unresolved(value) -> list[str]:
    import re

    text = str(value)
    return sorted(set(re.findall(r"\{\{?([\w:.-]+)\}?\}", text)))


def _template_snapshot(template) -> dict:
    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "platform": template.platform,
        "category_id": template.category_id,
        "is_default": template.is_default,
        "template_data": template.template_data,
    }

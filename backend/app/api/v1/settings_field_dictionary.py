"""Settings API for V5 unified field dictionary governance."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/settings", tags=["settings"])


class UnifiedFieldDictionaryDraftUpdate(BaseModel):
    dictionary: dict = Field(default_factory=dict)
    change_note: str = ""


class UnifiedFieldDictionaryPublishRequest(BaseModel):
    expected_version: Optional[str] = None


class PlatformFieldGroupsDraftUpdate(BaseModel):
    schema: dict = Field(default_factory=dict)
    change_note: str = ""


class PlatformFieldGroupsPublishRequest(BaseModel):
    expected_version: Optional[str] = None


@router.get("/field-dictionary", response_model=ApiResponse)
async def get_field_dictionary_versions(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return active, draft and archived unified field dictionary versions."""
    versions = await config_service.get_unified_field_dictionary_versions(db)
    return ApiResponse(
        data=versions,
        status="ready",
        source_refs=[source_ref("system_config", "platform.unified_field_dictionary", label="统一字段字典")],
        evidence_window="当前 system_config 字段字典生效版、草稿和历史版本",
        confidence_reason="字段字典由设置中心统一读取；草稿不影响运行时字段映射，发布后才进入 /config/init。",
        data_gaps=[],
    )


@router.patch("/field-dictionary/draft", response_model=ApiResponse)
async def save_field_dictionary_draft(
    req: UnifiedFieldDictionaryDraftUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Save a unified field dictionary draft without changing runtime fields."""
    try:
        draft = await config_service.save_unified_field_dictionary_draft(
            db,
            req.dictionary,
            updated_by=admin.username,
            change_note=req.change_note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=admin,
        action="field_dictionary_draft_save",
        resource_type="system_config",
        resource_id="platform.unified_field_dictionary.draft",
        old_value=None,
        new_value={"version": draft.get("version"), "field_count": len(draft.get("fields", []))},
        detail=req.change_note or "保存统一字段字典草稿",
    )
    return ApiResponse(
        data={
            "version": draft.get("version"),
            "status": draft.get("status"),
            "field_count": len(draft.get("fields", [])),
        }
    )


@router.post("/field-dictionary/publish", response_model=ApiResponse)
async def publish_field_dictionary_draft(
    req: UnifiedFieldDictionaryPublishRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Publish a draft unified field dictionary as the active runtime version."""
    try:
        active = await config_service.publish_unified_field_dictionary_draft(
            db,
            published_by=admin.username,
            expected_version=req.expected_version,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=admin,
        action="field_dictionary_publish",
        resource_type="system_config",
        resource_id="platform.unified_field_dictionary",
        old_value=None,
        new_value={"version": active.get("version"), "field_count": len(active.get("fields", []))},
        detail="发布统一字段字典草稿",
    )
    return ApiResponse(
        data={
            "version": active.get("version"),
            "status": active.get("status"),
            "field_count": len(active.get("fields", [])),
        }
    )


@router.get("/platform-field-groups", response_model=ApiResponse)
async def get_platform_field_group_versions(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return active, draft and history versions for platform product field groups."""
    versions = await config_service.get_platform_product_field_group_versions(db)
    return ApiResponse(
        data=versions,
        status="ready",
        source_refs=[source_ref("system_config", "platform.product_field_groups", label="平台字段组 Schema")],
        evidence_window="当前 system_config 平台字段组生效版、草稿和历史版本",
        confidence_reason="平台字段组由设置中心统一治理；草稿不影响运行时字段渲染，发布后才进入 /config/init。",
        data_gaps=[],
    )


@router.patch("/platform-field-groups/draft", response_model=ApiResponse)
async def save_platform_field_group_draft(
    req: PlatformFieldGroupsDraftUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Save a platform product field group Schema draft without changing runtime fields."""
    try:
        draft = await config_service.save_platform_product_field_group_draft(
            db,
            req.schema,
            updated_by=admin.username,
            change_note=req.change_note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=admin,
        action="platform_field_groups_draft_save",
        resource_type="system_config",
        resource_id="platform.product_field_groups.draft",
        old_value=None,
        new_value={"version": draft.get("version"), "platforms": [key for key in ("shopee", "tiktok", "temu") if key in draft]},
        detail=req.change_note or "保存平台字段组草稿",
    )
    return ApiResponse(data={"version": draft.get("version"), "status": draft.get("status")})


@router.post("/platform-field-groups/publish", response_model=ApiResponse)
async def publish_platform_field_group_draft(
    req: PlatformFieldGroupsPublishRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Publish a platform product field group Schema draft as active runtime fields."""
    try:
        active = await config_service.publish_platform_product_field_group_draft(
            db,
            published_by=admin.username,
            expected_version=req.expected_version,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=admin,
        action="platform_field_groups_publish",
        resource_type="system_config",
        resource_id="platform.product_field_groups",
        old_value=None,
        new_value={"version": active.get("version"), "platforms": [key for key in ("shopee", "tiktok", "temu") if key in active]},
        detail="发布平台字段组草稿",
    )
    return ApiResponse(data={"version": active.get("version"), "status": active.get("status")})

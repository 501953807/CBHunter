"""Unified dictionary API — system defaults + user overrides."""

import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.sys_dict import SysDictItem
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.sys_dict_service import get_sys_dict, get_user_dict, create_sys_item, update_sys_item, delete_sys_item
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/dict", tags=["dictionary"])


@router.get("", response_model=ApiResponse)
async def get_dictionary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return dictionary merged with current user's overrides."""
    data = await get_user_dict(db, current_user.id)
    return ApiResponse(data=data)


@router.get("/platforms", response_model=ApiResponse)
async def get_platforms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await get_user_dict(db, current_user.id)
    return ApiResponse(data=items.get("platforms", []))


@router.get("/markets", response_model=ApiResponse)
async def get_markets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await get_user_dict(db, current_user.id)
    return ApiResponse(data=items.get("markets", []))


@router.get("/categories", response_model=ApiResponse)
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await get_user_dict(db, current_user.id)
    return ApiResponse(data=items.get("categories", []))


# ========== Admin only: system dictionary CRUD ==========

@router.get("/admin/all", response_model=ApiResponse)
async def admin_list_dict(
    type: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all system dictionary items (including disabled)."""
    from sqlalchemy import select
    from app.models.sys_dict import SysDictItem
    q = select(SysDictItem).order_by(SysDictItem.type, SysDictItem.sort_order)
    if type:
        q = q.where(SysDictItem.type == type)
    result = await db.execute(q)
    items = [{"id": i.id, "type": i.type, "label": i.label, "sort_order": i.sort_order, "is_active": i.is_active,
              **(i.extra or {})}
             for i in result.scalars().all()]
    return ApiResponse(data=items)


@router.post("/admin/item", response_model=ApiResponse, status_code=201)
async def admin_create_dict_item(
    id: str = Query(...),
    type: str = Query(...),
    label: str = Query(...),
    extra: Optional[str] = Query(None),
    sort_order: int = Query(0),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    parsed_extra = _parse_extra(extra)
    item = await create_sys_item(db, {
        "id": id, "type": type, "label": label,
        "extra": parsed_extra, "sort_order": sort_order,
    })
    await record_audit_event(
        db,
        user=admin,
        action="create",
        resource_type="sys_dict_item",
        resource_id=item.id,
        new_value=_sys_dict_snapshot(item),
        detail="通过字典管理接口创建系统字典项",
    )
    return ApiResponse(data={"id": item.id, "type": item.type})


@router.put("/admin/item/{item_id}", response_model=ApiResponse)
async def admin_update_dict_item(
    item_id: str,
    label: Optional[str] = Query(None),
    extra: Optional[str] = Query(None),
    sort_order: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    old_item = await _get_sys_dict_item(db, item_id)
    if not old_item:
        raise HTTPException(status_code=404)
    old_value = _sys_dict_snapshot(old_item)
    data = {
        k: v for k, v in {
            "label": label,
            "extra": _parse_extra(extra) if extra is not None else None,
            "sort_order": sort_order,
            "is_active": is_active,
        }.items()
        if v is not None
    }
    item = await update_sys_item(db, item_id, data)
    if not item:
        raise HTTPException(status_code=404)
    await record_audit_event(
        db,
        user=admin,
        action="update",
        resource_type="sys_dict_item",
        resource_id=item.id,
        old_value=old_value,
        new_value=_sys_dict_snapshot(item),
        detail="通过字典管理接口更新系统字典项",
    )
    return ApiResponse(data={"id": item.id})


@router.delete("/admin/item/{item_id}", response_model=ApiResponse)
async def admin_delete_dict_item(
    item_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_sys_dict_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404)
    old_value = _sys_dict_snapshot(item)
    ok = await delete_sys_item(db, item_id)
    if not ok:
        raise HTTPException(status_code=404)
    await record_audit_event(
        db,
        user=admin,
        action="delete",
        resource_type="sys_dict_item",
        resource_id=item_id,
        old_value=old_value,
        detail="通过字典管理接口删除系统字典项",
    )
    return ApiResponse(data={"message": "Deleted"})


async def _get_sys_dict_item(db: AsyncSession, item_id: str) -> Optional[SysDictItem]:
    result = await db.execute(select(SysDictItem).where(SysDictItem.id == item_id))
    return result.scalar_one_or_none()


def _parse_extra(value: Optional[str]) -> dict:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="extra 必须是 JSON 对象字符串") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="extra 必须是 JSON 对象")
    return parsed


def _sys_dict_snapshot(item: SysDictItem) -> dict:
    return {
        "id": item.id,
        "type": item.type,
        "label": item.label,
        "extra": item.extra,
        "sort_order": item.sort_order,
        "is_active": item.is_active,
    }

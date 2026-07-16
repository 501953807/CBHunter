"""Settings API for cloud warehouse / freight-forwarder configuration."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/settings", tags=["settings"])


class WarehouseItem(BaseModel):
    id: Optional[str] = None
    name: str
    city: str = ""
    address: str
    contact: str = ""
    fee_per_parcel: Optional[float] = None
    is_default: bool = False
    service_type: str
    market_scope: str = ""
    integration_status: str
    inventory_sync_mode: str


@router.get("/warehouses", response_model=ApiResponse)
async def list_warehouses(current_user: User = Depends(get_current_user)):
    settings = current_user.settings or {}
    warehouses = settings.get("warehouses", [])
    return ApiResponse(
        data=warehouses,
        status="ready" if warehouses else "configuration_required",
        source_refs=[source_ref("warehouse", item.get("id"), label=item.get("name")) for item in warehouses],
        evidence_window="当前用户云仓/货代配置",
        confidence_reason="列表只读取当前用户保存的仓库地址与实际处理费。",
        data_gaps=[] if warehouses else ["暂无云仓或货代配置"],
    )


@router.post("/warehouses", response_model=ApiResponse)
async def create_warehouse(
    req: WarehouseItem,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _validate_warehouse_item(db, req)
    settings = current_user.settings or {}
    warehouses = settings.get("warehouses", [])
    new_wh = req.model_dump()
    new_wh["id"] = str(uuid.uuid4())[:8]
    if req.is_default:
        for wh in warehouses:
            wh["is_default"] = False
    warehouses.append(new_wh)
    settings["warehouses"] = warehouses
    current_user.settings = settings
    db.add(current_user)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="warehouse_create",
        resource_type="warehouse",
        resource_id=new_wh["id"],
        new_value=new_wh,
        detail="新增云仓/货代配置",
    )
    return ApiResponse(data=new_wh)


@router.put("/warehouses/{wh_id}", response_model=ApiResponse)
async def update_warehouse(
    wh_id: str,
    req: WarehouseItem,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _validate_warehouse_item(db, req)
    settings = current_user.settings or {}
    warehouses = settings.get("warehouses", [])
    old_value = None
    for wh in warehouses:
        if wh.get("id") == wh_id:
            old_value = dict(wh)
            update_data = req.model_dump()
            update_data["id"] = wh_id
            if update_data.pop("is_default", False):
                for w in warehouses:
                    w["is_default"] = False
            wh.update(update_data)
            break
    settings["warehouses"] = warehouses
    current_user.settings = settings
    db.add(current_user)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="warehouse_update",
        resource_type="warehouse",
        resource_id=wh_id,
        old_value=old_value,
        new_value=next((w for w in warehouses if w.get("id") == wh_id), None),
        detail="更新云仓/货代配置",
    )
    return ApiResponse(data={"message": "Updated"})


@router.delete("/warehouses/{wh_id}", response_model=ApiResponse)
async def delete_warehouse(
    wh_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = current_user.settings or {}
    warehouses = settings.get("warehouses", [])
    old_value = next((w for w in warehouses if w.get("id") == wh_id), None)
    settings["warehouses"] = [w for w in warehouses if w.get("id") != wh_id]
    current_user.settings = settings
    db.add(current_user)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="warehouse_delete",
        resource_type="warehouse",
        resource_id=wh_id,
        old_value=old_value,
        detail="删除云仓/货代配置",
    )
    return ApiResponse(data={"message": "Deleted"})


async def _validate_warehouse_item(db: AsyncSession, req: WarehouseItem) -> None:
    dicts = await config_service.get_all_config(db)
    checks = [
        ("warehouse_service_types", req.service_type, "仓储服务类型"),
        ("warehouse_integration_statuses", req.integration_status, "仓储 API 状态"),
        ("warehouse_inventory_sync_modes", req.inventory_sync_mode, "库存同步方式"),
    ]
    for dict_key, value, label in checks:
        allowed = {item.get("id") for item in dicts.get(dict_key, [])}
        if value not in allowed:
            raise HTTPException(status_code=400, detail=f"{label}不在统一字典中")

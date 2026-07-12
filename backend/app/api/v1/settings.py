"""系统设置 API — 账号信息/字典/平台费率/接口密钥/AI Provider/云仓/预警."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.fee_template import FeeTemplate
from app.schemas.common import ApiResponse
from app.services.provider_service import list_providers, create_provider, update_provider, delete_provider, save_user_config
from app.services.ai_task_matrix_service import get_ai_task_matrix
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.entitlement_service import require_entitlement
from app.services.system_config_service import get_config_catalog, is_sensitive_key
from app.services.permission_service import list_access_control_matrix, replace_user_roles
from app.services.store_access_service import list_store_access_matrix, replace_user_store_access
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/settings", tags=["settings"])


# ========== Profile ==========

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


@router.get("/profile", response_model=ApiResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    return ApiResponse(data={
        "display_name": current_user.display_name or "",
        "email": current_user.email or "",
        "username": current_user.username,
    })


@router.put("/profile", response_model=ApiResponse)
async def update_profile(
    req: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    old_value = {"display_name": current_user.display_name, "email": current_user.email}
    if req.display_name is not None:
        current_user.display_name = req.display_name
    if req.email is not None:
        current_user.email = req.email
    db.add(current_user)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="profile_update",
        resource_type="user",
        resource_id=current_user.id,
        old_value=old_value,
        new_value={"display_name": current_user.display_name, "email": current_user.email},
        detail="更新个人资料",
    )
    return ApiResponse(data={"message": "Profile updated"})


@router.put("/password", response_model=ApiResponse)
async def change_password(
    req: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.auth_service import verify_password, hash_password
    if not verify_password(req.old_password, current_user.hashed_password):
        raise HTTPException(400, "当前密码错误")
    current_user.hashed_password = hash_password(req.new_password)
    db.add(current_user)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="password_change",
        resource_type="user",
        resource_id=current_user.id,
        detail="用户修改自己的登录密码",
    )
    return ApiResponse(data={"message": "Password changed"})


# ========== Fee Rates — editable DB-backed table ==========


class FeeRateItem(BaseModel):
    id: str
    commission: float
    transaction: float
    tech: float
    low_value_tax: float


@router.get("/fee-rates", response_model=ApiResponse)
async def get_fee_rates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回费率表（读取 fee_templates，不注入默认费率）."""
    result = await db.execute(select(FeeTemplate).where(FeeTemplate.is_active == True))
    platform_labels = {
        item["id"]: item["label"]
        for item in await config_service.get_platforms(db)
    }
    grouped: dict[str, list[dict]] = {}
    flat: list[dict] = []
    for fee in result.scalars().all():
        raw_rates = [fee.commission_pct, fee.transaction_fee_pct, fee.tech_service_pct, fee.vat_pct]
        item = {
            "id": f"{fee.platform}_{fee.market}",
            "platform": platform_labels.get(fee.platform, fee.platform),
            "market": fee.market,
            "commission": fee.commission_pct / 100 if fee.commission_pct is not None else None,
            "transaction": fee.transaction_fee_pct / 100 if fee.transaction_fee_pct is not None else None,
            "tech": fee.tech_service_pct / 100 if fee.tech_service_pct is not None else None,
            "low_value_tax": fee.vat_pct / 100 if fee.vat_pct is not None else None,
        }
        total = sum(value for value in raw_rates if value is not None) / 100 if all(value is not None for value in raw_rates) else None
        item["total"] = round(total, 4) if total is not None else None
        item["total_pct"] = f"{total*100:.1f}%" if total is not None else None
        grouped.setdefault(item["platform"], []).append(item)
        flat.append(item)
    gaps = [] if flat else ["暂无启用平台费率模板"]
    if any(item["total"] is None for item in flat):
        gaps.append("部分平台费率模板字段不完整")
    return ApiResponse(
        data={"grouped": grouped, "flat": flat},
        status="ready" if flat and not gaps else "configuration_required",
        source_refs=[source_ref("fee_template", item["id"], label=f"{item['platform']}/{item['market']}") for item in flat],
        evidence_window="当前启用平台费率模板",
        confidence_reason="费率直接读取数据库配置；未知费率保持为空，不按 0% 处理。",
        data_gaps=gaps,
    )


@router.put("/fee-rates", response_model=ApiResponse)
async def update_fee_rate(
    req: FeeRateItem,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新某条费率（保存到 fee_templates 表）."""
    # Validate: all fee rates must be 0-1 (0% to 100%)
    for k in ("commission", "transaction", "tech", "low_value_tax"):
        v = getattr(req, k)
        if v < 0 or v > 1:
            raise HTTPException(400, f"{k} 值必须介于 0-1 之间（当前: {v}）")

    platform, market = req.id.split("_", 1) if "_" in req.id else ("", "")
    if not platform or not market:
        raise HTTPException(400, "费率ID必须为 platform_market 格式")
    result = await db.execute(
        select(FeeTemplate).where(FeeTemplate.platform == platform, FeeTemplate.market == market)
    )
    fee = result.scalar_one_or_none()
    old_value = _fee_snapshot(fee)
    if not fee:
        fee = FeeTemplate(platform=platform, market=market, is_active=True)
        db.add(fee)
    fee.commission_pct = req.commission * 100
    fee.transaction_fee_pct = req.transaction * 100
    fee.tech_service_pct = req.tech * 100
    fee.vat_pct = req.low_value_tax * 100
    fee.notes = "settings"
    await db.commit()
    await record_audit_event(
        db,
        user=admin,
        action="fee_rate_update",
        resource_type="fee_template",
        resource_id=req.id,
        old_value=old_value,
        new_value=_fee_snapshot(fee),
        detail="设置中心更新平台费率",
    )
    return ApiResponse(data={"message": "费率已更新"})


def _fee_snapshot(fee: Optional[FeeTemplate]) -> Optional[dict]:
    if not fee:
        return None
    return {
        "platform": fee.platform,
        "market": fee.market,
        "commission_pct": fee.commission_pct,
        "transaction_fee_pct": fee.transaction_fee_pct,
        "tech_service_pct": fee.tech_service_pct,
        "vat_pct": fee.vat_pct,
        "is_active": fee.is_active,
    }


# ========== Cloud Warehouse / 货代管理 ==========

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
    import uuid
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


# ========== AI Provider (数据库管理) ==========

class ProviderCreateUpdate(BaseModel):
    id: Optional[str] = None
    name: str
    type: str
    capabilities: list[str] = Field(default_factory=list)
    cost_tier: str = "free"
    check_cmd: Optional[str] = None
    needs_key: Optional[str] = None
    needs_overseas: bool = False
    description: Optional[str] = None
    priority: int = 999
    enabled: bool = True


@router.get("/providers", response_model=ApiResponse)
async def get_providers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出所有 Provider（含用户配置状态）。"""
    items = await list_providers(db, current_user.id)
    return ApiResponse(
        data=items,
        status="ready" if items else "configuration_required",
        source_refs=[source_ref("ai_provider", item.get("id"), label=item.get("name")) for item in items],
        evidence_window="当前 AI Provider 目录与用户配置状态",
        confidence_reason="Provider 可用性来自持久化配置和真实运行能力检查。",
        data_gaps=[] if items else ["暂无 AI Provider 配置"],
    )


@router.get("/provider-task-matrix", response_model=ApiResponse)
async def get_provider_task_matrix(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return AI task types and provider capability coverage."""
    matrix = await get_ai_task_matrix(db, current_user.id)
    task_refs = [
        source_ref("ai_task", task["task_type"], label=task.get("label") or task["task_type"])
        for task in matrix["tasks"]
    ]
    return ApiResponse(
        data=matrix,
        status=matrix["status"],
        source_refs=task_refs,
        evidence_window="当前 AI Provider 能力与任务矩阵",
        confidence_reason="任务可用性基于 Provider 当前可用状态、能力标签、用户启用状态和任务所需能力计算。",
        data_gaps=matrix["data_gaps"],
    )


@router.post("/providers", response_model=ApiResponse, status_code=201)
async def add_provider(
    req: ProviderCreateUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员新增自定义 Provider。"""
    if not req.id:
        raise HTTPException(400, "Provider ID 不能为空")
    p = await create_provider(db, req.model_dump())
    await record_audit_event(
        db,
        user=admin,
        action="ai_provider_create",
        resource_type="ai_provider",
        resource_id=p.id,
        new_value=req.model_dump(exclude={"id"}) | {"id": p.id},
        detail="新增 AI Provider",
    )
    return ApiResponse(data={"id": p.id, "name": p.name})


@router.put("/providers/{provider_id}", response_model=ApiResponse)
async def edit_provider(
    provider_id: str,
    req: ProviderCreateUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员编辑 Provider。"""
    p = await update_provider(db, provider_id, req.model_dump(exclude_unset=True, exclude={"id"}))
    if not p:
        raise HTTPException(404)
    await record_audit_event(
        db,
        user=admin,
        action="ai_provider_update",
        resource_type="ai_provider",
        resource_id=provider_id,
        new_value=req.model_dump(exclude_unset=True, exclude={"id"}),
        detail="更新 AI Provider",
    )
    return ApiResponse(data={"id": p.id})


@router.delete("/providers/{provider_id}", response_model=ApiResponse)
async def remove_provider(
    provider_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员删除自定义 Provider（默认不可删）。"""
    ok = await delete_provider(db, provider_id)
    if not ok:
        raise HTTPException(400, "默认 Provider 不可删除或不存在")
    await record_audit_event(
        db,
        user=admin,
        action="ai_provider_delete",
        resource_type="ai_provider",
        resource_id=provider_id,
        detail="删除 AI Provider",
    )
    return ApiResponse(data={"message": "Deleted"})


# ========== 用户自己的 Provider 配置 ==========

class UserProviderConfig(BaseModel):
    """用户的 Provider 配置：启用 + 优先级 + API Key。"""
    enabled: bool = True
    priority: int = 999
    api_key: str = ""
    has_api_key: bool = False


class SaveUserProvidersRequest(BaseModel):
    config: dict[str, UserProviderConfig]  # key=provider_id


@router.get("/my-providers", response_model=ApiResponse)
async def get_my_providers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的 Provider 配置。"""
    from app.services.provider_service import _get_user_provider_config
    raw = await _get_user_provider_config(db, current_user.id)
    return ApiResponse(data={
        "providers": raw,
        "has_api_keys": any(v.get("has_api_key") for v in raw.values()) if raw else False,
    })


@router.put("/my-providers", response_model=ApiResponse)
async def save_my_providers(
    req: SaveUserProvidersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """保存当前用户的 Provider 配置（优先级 + API Key 标记）。"""
    old_config = dict((current_user.settings or {}).get("provider_config", {}))
    config: dict = {}
    for pid, uc in req.config.items():
        config[pid] = {
            "enabled": uc.enabled,
            "priority": uc.priority,
            "has_api_key": bool(uc.api_key or uc.has_api_key),
        }
    await save_user_config(db, current_user, config)
    await record_audit_event(
        db,
        user=current_user,
        action="user_ai_provider_config_update",
        resource_type="user_ai_provider_config",
        resource_id=current_user.id,
        old_value=old_config,
        new_value=config,
        detail="更新个人 AI Provider 启用、优先级和密钥标记",
    )
    return ApiResponse(data={"message": "Saved"})


# ========== User dictionary overrides ==========

class DictOverrideItem(BaseModel):
    item_id: str
    enabled: bool = True


class SaveDictOverridesRequest(BaseModel):
    overrides: dict[str, bool]  # {"MY": true, "PH": false}


@router.get("/dict-overrides", response_model=ApiResponse)
async def get_dict_overrides(
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的字典覆盖配置。"""
    overrides = (current_user.settings or {}).get("dict_overrides", {})
    return ApiResponse(data={"overrides": overrides})


@router.put("/dict-overrides", response_model=ApiResponse)
async def save_dict_overrides(
    req: SaveDictOverridesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """保存用户的字典覆盖 — 禁用/启用特定的平台/市场/品类。"""
    s = current_user.settings or {}
    old_value = dict(s.get("dict_overrides", {}))
    s["dict_overrides"] = req.overrides
    current_user.settings = s
    db.add(current_user)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="dict_overrides_update",
        resource_type="dict_overrides",
        resource_id=current_user.id,
        old_value=old_value,
        new_value=req.overrides,
        detail="更新个人字典启停配置",
    )
    return ApiResponse(data={"message": "Saved"})


# ========== System Config (credentials store, replaces .env) ==========

import json
from typing import Optional
from app.models.system_config import SystemConfig
from app.utils.encryption import encrypt, decrypt

def _mask_value(key: str, value: Optional[str]) -> Optional[str]:
    """Return a masked preview — 'abc...xyz' for sensitive fields."""
    if value is None:
        return None
    # Pinterest account is JSON, mask the password portion
    if key == "pinterest_account":
        try:
            data = json.loads(value)
            pw = data.get("password", "")
            masked_pw = pw[:2] + "..." + pw[-2:] if len(pw) > 6 else "***"
            return f"{data.get('email', '')} / {masked_pw}"
        except (json.JSONDecodeError, TypeError):
            return "已配置"
    if is_sensitive_key(key) and len(value) > 8:
        return value[:4] + "..." + value[-4:]
    return value


def _system_config_snapshot(row: SystemConfig, key: str) -> dict:
    return {
        "key": row.key,
        "label": row.label,
        "configured": bool(row.value),
        "sensitive": is_sensitive_key(key),
        "updated_at": row.updated_at,
    }


@router.get("/system-config", response_model=ApiResponse)
async def list_system_config(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """列出所有系统配置项（敏感字段脱敏返回）。"""
    result = await db.execute(select(SystemConfig))
    rows = list(result.scalars().all())
    rows_by_key = {row.key: row for row in rows}
    items = []
    definitions = get_config_catalog()
    known_keys = {item["key"] for item in definitions}
    definitions.extend({"key": row.key, "label": row.label} for row in rows if row.key not in known_keys)
    for definition in definitions:
        row = rows_by_key.get(definition["key"])
        if not row:
            catalog_default = definition.get("default_value")
            items.append({
                **definition,
                "value": json.dumps(catalog_default, ensure_ascii=False) if catalog_default is not None else None,
                "configured": catalog_default is not None,
                "value_source": "catalog_default" if catalog_default is not None else None,
                "sensitive": is_sensitive_key(definition["key"]),
                "updated_at": None,
            })
            continue
        raw = row.value
        if is_sensitive_key(row.key) and raw:
            try:
                raw = decrypt(raw)
            except Exception as exc:
                logger.warning("Failed to decrypt system config %s: %s", row.key, exc)
                raw = None
        items.append({
            **definition,
            "key": row.key,
            "label": row.label or definition.get("label"),
            "value": _mask_value(row.key, raw),
            "configured": bool(raw),
            "sensitive": is_sensitive_key(row.key),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        })
    return ApiResponse(
        data=items,
        status="ready",
        source_refs=[source_ref("system_config", item["key"], label=item.get("label")) for item in items],
        evidence_window="当前系统配置目录与持久化状态",
        confidence_reason="敏感配置只返回脱敏状态；未保存配置保持未设置。",
        data_gaps=[],
    )


# ========== Pinterest Account (composite email + password) ==========
# MUST be defined before the generic /{key} routes to avoid shadowing

class PinterestAccountUpdate(BaseModel):
    email: str = ""
    password: str = ""


@router.get("/system-config/pinterest-account", response_model=ApiResponse)
async def get_pinterest_account(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取 Pinterest 账号配置（邮箱 + 密码状态）。"""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "pinterest_account"))
    row = result.scalar_one_or_none()
    if not row or not row.value:
        return ApiResponse(data={"email": None, "configured": False})

    try:
        raw = decrypt(row.value)
        data = json.loads(raw)
    except Exception as exc:
        logger.warning("Failed to read Pinterest account configuration: %s", exc)
        return ApiResponse(data={"email": None, "configured": False})

    pw = data.get("password", "")
    masked_pw = pw[:2] + "..." + pw[-2:] if len(pw) > 6 else "***"
    return ApiResponse(data={
        "email": data.get("email", ""),
        "password_masked": masked_pw,
        "configured": bool(data.get("email") and data.get("password")),
    })


@router.put("/system-config/pinterest-account", response_model=ApiResponse)
async def update_pinterest_account(
    req: PinterestAccountUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """保存 Pinterest 账号（邮箱 + 密码，加密 JSON 存储）。"""
    if not req.email or not req.password:
        raise HTTPException(400, "邮箱和密码不能为空")

    value = json.dumps({"email": req.email, "password": req.password})
    encrypted = encrypt(value)

    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "pinterest_account"))
    row = result.scalar_one_or_none()
    old_configured = bool(row and row.value)
    if row:
        row.value = encrypted
    else:
        row = SystemConfig(key="pinterest_account", value=encrypted, label="Pinterest 账号")
        db.add(row)
    await db.commit()

    # Delete old separate keys if they exist
    for old_key in ("pinterest_email", "pinterest_password"):
        await db.execute(
            __import__("sqlalchemy").delete(SystemConfig).where(SystemConfig.key == old_key)
        )
    await db.commit()

    await record_audit_event(
        db,
        user=admin,
        action="credential_update",
        resource_type="system_config",
        resource_id="pinterest_account",
        old_value={"configured": old_configured},
        new_value={"email": req.email, "configured": True},
        detail="更新 Pinterest 账号凭证",
    )

    return ApiResponse(data={"email": req.email, "configured": True})


class SystemConfigUpdate(BaseModel):
    value: str = ""
    label: Optional[str] = None


@router.put("/system-config/{key}", response_model=ApiResponse)
async def update_system_config(
    key: str,
    req: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """更新系统配置项。敏感字段自动加密存储。"""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()

    existed = row is not None
    old_value = _system_config_snapshot(row, key) if row else None

    value = req.value
    if is_sensitive_key(key) and value:
        value = encrypt(value)

    if row:
        row.value = value if value else None
        if req.label:
            row.label = req.label
    else:
        row = SystemConfig(key=key, value=value if value else None, label=req.label)
        db.add(row)

    await db.commit()

    await record_audit_event(
        db,
        user=admin,
        action="config_update" if existed else "config_create",
        resource_type="system_config",
        resource_id=key,
        old_value=old_value,
        new_value=_system_config_snapshot(row, key),
        detail=f"更新系统配置 {key}",
    )

    return ApiResponse(data={"key": key, "configured": bool(req.value)})


@router.get("/system-config/{key}", response_model=ApiResponse)
async def get_system_config(
    key: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取单个配置项。"""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()
    if not row:
        return ApiResponse(data={"key": key, "value": None, "configured": False})
    raw = row.value
    if is_sensitive_key(key) and raw:
        try:
            raw = decrypt(raw)
        except Exception as exc:
            logger.warning("Failed to decrypt system config %s: %s", key, exc)
            raw = None
    return ApiResponse(data={
        "key": row.key,
        "label": row.label,
        "value": _mask_value(row.key, raw),
        "configured": bool(raw),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    })


# ══════════════════════════════════════════
# User Management CRUD
# ══════════════════════════════════════════
from app.schemas.auth import PasswordResetRequest, RegisterRequest
from app.services.auth_service import register_user, hash_password


class UserRoleUpdate(BaseModel):
    role_ids: list[str] = Field(default_factory=list)


class UserStoreAccessUpdate(BaseModel):
    store_ids: list[str] = Field(default_factory=list)
    store_role: str = "operator"


@router.get("/access-control", response_model=ApiResponse)
async def get_access_control(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Return roles, permissions, users, and store assignments for access management."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = list(result.scalars().all())
    access = await list_access_control_matrix(db)
    store_access = await list_store_access_matrix(db)
    data = {
        **access,
        **store_access,
        "users": [{
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "email": u.email,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "role_ids": access["user_roles"].get(u.id, []),
            "store_ids": store_access["user_stores"].get(u.id, []),
        } for u in users],
    }
    gaps = []
    if not users:
        gaps.append("暂无系统用户")
    if not access["roles"]:
        gaps.append("暂无可分配角色")
    if not store_access["stores"]:
        gaps.append("暂无可授权平台店铺")
    return ApiResponse(
        data=data,
        status="ready" if users and access["roles"] else "configuration_required",
        source_refs=[source_ref("user", user.id, label=user.username) for user in users]
                    + [source_ref("role", role["id"], label=role["name"]) for role in access["roles"]]
                    + [source_ref("platform_account", store["id"], label=store["account_name"]) for store in store_access["stores"]],
        evidence_window="当前用户、角色与店铺授权快照",
        confidence_reason="授权矩阵直接读取当前系统用户、角色权限和平台店铺分配。",
        data_gaps=gaps,
    )


@router.put("/users/{username}/roles", response_model=ApiResponse)
async def update_user_roles(
    username: str,
    req: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    old_value = {"role_ids": (await list_access_control_matrix(db))["user_roles"].get(user.id, [])}
    try:
        role_ids = await replace_user_roles(db, user, req.role_ids, admin)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    await record_audit_event(
        db,
        user=admin,
        action="user_roles_update",
        resource_type="user",
        resource_id=user.id,
        old_value=old_value,
        new_value={"role_ids": role_ids},
        detail=f"管理员更新用户 {username} 角色",
    )
    return ApiResponse(data={"username": username, "role_ids": role_ids})


@router.put("/users/{username}/stores", response_model=ApiResponse)
async def update_user_store_access(
    username: str,
    req: UserStoreAccessUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    old_value = {"store_ids": (await list_store_access_matrix(db))["user_stores"].get(user.id, [])}
    try:
        store_ids = await replace_user_store_access(db, user, req.store_ids, req.store_role)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    await record_audit_event(
        db,
        user=admin,
        action="user_store_access_update",
        resource_type="user",
        resource_id=user.id,
        old_value=old_value,
        new_value={"store_ids": store_ids, "store_role": req.store_role},
        detail=f"管理员更新用户 {username} 店铺授权",
    )
    return ApiResponse(data={"username": username, "store_ids": store_ids, "store_role": req.store_role})

@router.get("/users", response_model=ApiResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all users (admin only in production)."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    data = [{
        "id": u.id, "username": u.username, "email": u.email,
        "display_name": u.display_name, "is_active": u.is_active, "is_admin": u.is_admin,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    } for u in users]
    return ApiResponse(
        data=data, status="ready" if data else "data_required",
        source_refs=[source_ref("user", item["id"], label=item["username"]) for item in data],
        evidence_window="当前系统用户目录", confidence_reason="仅管理员可读取真实用户账号状态。",
        data_gaps=[] if data else ["暂无系统用户"],
    )

@router.post("/users", response_model=ApiResponse, status_code=201)
async def create_user(
    req: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new user account."""
    user_count = await db.scalar(select(func.count(User.id))) or 0
    await require_entitlement(db, admin, "users.max", user_count + 1)
    try:
        user = await register_user(db, req)
        await record_audit_event(
            db,
            user=admin,
            action="user_create",
            resource_type="user",
            resource_id=user.id,
            new_value={"username": user.username, "email": user.email},
            detail="管理员创建系统用户",
        )
        return ApiResponse(data={"username": user.username, "email": user.email, "message": "账号已创建"})
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.put("/users/{username}", response_model=ApiResponse)
async def update_user(
    username: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update user display_name and email."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    old_value = {"display_name": user.display_name, "email": user.email}
    if "display_name" in data:
        user.display_name = data["display_name"]
    if "email" in data:
        user.email = data["email"]
    await db.commit()
    await record_audit_event(
        db,
        user=admin,
        action="user_update",
        resource_type="user",
        resource_id=user.id,
        old_value=old_value,
        new_value={"display_name": user.display_name, "email": user.email},
        detail=f"管理员更新用户 {username}",
    )
    return ApiResponse(data={"message": "已更新"})

@router.delete("/users/{username}", response_model=ApiResponse)
async def delete_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a user account."""
    if username == admin.username:
        raise HTTPException(400, "不能删除自己")
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    old_value = {"username": user.username, "email": user.email, "is_admin": user.is_admin}
    user_id = user.id
    await db.delete(user)
    await db.commit()
    await record_audit_event(
        db,
        user=admin,
        action="user_delete",
        resource_type="user",
        resource_id=user_id,
        old_value=old_value,
        detail=f"管理员删除用户 {username}",
    )
    return ApiResponse(data={"message": "已删除"})

@router.put("/users/{username}/password", response_model=ApiResponse)
async def change_user_password(
    username: str,
    req: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Reset user password (admin action)."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    user.hashed_password = hash_password(req.password)
    await db.commit()
    await record_audit_event(
        db,
        user=admin,
        action="user_password_reset",
        resource_type="user",
        resource_id=user.id,
        detail=f"管理员重置用户 {username} 密码",
    )
    return ApiResponse(data={"message": "密码已修改"})

# ══════════════════════════════════════════
# Dictionary CRUD
# ══════════════════════════════════════════
from app.models.sys_dict import SysDictItem
from app.services.dictionary import get_all_dicts, add_dict_item, update_dict_item, delete_dict_item

DICT_TYPE_TO_DB_TYPE = {
    "categories": "category",
    "markets": "market",
    "platforms": "platform",
    "finance_entry_types": "finance_entry_type",
    "operation_record_types": "operation_record_type",
    "operation_record_statuses": "operation_record_status",
    "carriers": "carrier",
    "shipping_methods": "shipping_method",
}

@router.get("/dict", response_model=ApiResponse)
async def get_dict(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Get all dictionary items."""
    data = await config_service.get_dictionary_admin_config(db)
    refs = [source_ref("sys_dict_item", item.get("id"), label=item.get("label"), meta={"group": group})
            for group, items in data["dictionaries"].items() for item in items]
    return ApiResponse(
        data=data, status="ready" if refs else "configuration_required", source_refs=refs,
        evidence_window="当前系统统一字典", confidence_reason="字典管理读取持久化系统字典，不注入前端兜底选项。",
        data_gaps=[] if refs else ["统一字典为空"],
    )

@router.post("/dict/{dict_type}", response_model=ApiResponse, status_code=201)
async def add_dict(
    dict_type: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Add a dictionary item."""
    if dict_type not in DICT_TYPE_TO_DB_TYPE:
        raise HTTPException(400, "不支持的字典类型")
    try:
        item = await add_dict_item(db, dict_type, data)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    await record_audit_event(
        db,
        user=admin,
        action="dict_item_create",
        resource_type=f"dict:{dict_type}",
        resource_id=str(item.get("id") or data.get("id") or ""),
        new_value=item,
        detail="新增系统字典项",
    )
    return ApiResponse(data=item)

@router.put("/dict/{dict_type}/{item_id}", response_model=ApiResponse)
async def update_dict(
    dict_type: str,
    item_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update a dictionary item."""
    if dict_type not in DICT_TYPE_TO_DB_TYPE:
        raise HTTPException(400, "不支持的字典类型")
    existing = await _get_settings_dict_item(db, dict_type, item_id)
    if not existing:
        raise HTTPException(404, "字典项不存在")
    old_value = _settings_dict_snapshot(existing)
    try:
        item = await update_dict_item(db, dict_type, item_id, data)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    await record_audit_event(
        db,
        user=admin,
        action="dict_item_update",
        resource_type=f"dict:{dict_type}",
        resource_id=item_id,
        old_value=old_value,
        new_value=item,
        detail="更新系统字典项",
    )
    return ApiResponse(data=item)

@router.delete("/dict/{dict_type}/{item_id}", response_model=ApiResponse)
async def delete_dict(
    dict_type: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a dictionary item."""
    if dict_type not in DICT_TYPE_TO_DB_TYPE:
        raise HTTPException(400, "不支持的字典类型")
    existing = await _get_settings_dict_item(db, dict_type, item_id)
    if not existing:
        raise HTTPException(404, "字典项不存在")
    old_value = _settings_dict_snapshot(existing)
    await delete_dict_item(db, dict_type, item_id)
    await record_audit_event(
        db,
        user=admin,
        action="dict_item_delete",
        resource_type=f"dict:{dict_type}",
        resource_id=item_id,
        old_value=old_value,
        detail="删除系统字典项",
    )
    return ApiResponse(data={"message": "已删除"})


async def _get_settings_dict_item(db: AsyncSession, dict_type: str, item_id: str) -> Optional[SysDictItem]:
    result = await db.execute(
        select(SysDictItem).where(
            SysDictItem.id == item_id,
            SysDictItem.type == DICT_TYPE_TO_DB_TYPE[dict_type],
        )
    )
    return result.scalar_one_or_none()


def _settings_dict_snapshot(item: SysDictItem) -> dict:
    return {
        "id": item.id,
        "type": item.type,
        "label": item.label,
        "sort_order": item.sort_order,
        "is_active": item.is_active,
        "extra": item.extra or {},
    }

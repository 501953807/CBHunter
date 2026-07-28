"""系统设置 API — 系统配置与 Pinterest 凭证配置."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref
from app.services.system_config_service import get_config_catalog, is_sensitive_key
from app.utils.encryption import decrypt, encrypt


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])


class PinterestAccountUpdate(BaseModel):
    email: str = ""
    password: str = ""


class SystemConfigUpdate(BaseModel):
    value: str = ""
    label: Optional[str] = None


def _mask_value(key: str, value: Optional[str]) -> Optional[str]:
    """Return a masked preview — 'abc...xyz' for sensitive fields."""
    if value is None:
        return None
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
        raise HTTPException(status_code=400, detail="邮箱和密码不能为空")

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

    for old_key in ("pinterest_email", "pinterest_password"):
        await db.execute(delete(SystemConfig).where(SystemConfig.key == old_key))
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

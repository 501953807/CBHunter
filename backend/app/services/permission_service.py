"""Unified permission service for roles, user permissions, and route guards."""

import json
from pathlib import Path
from typing import Iterable

from fastapi import Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.access_control import Permission, Role, RolePermission, UserRole
from app.models.user import User

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
ROLE_PERMISSION_DEFAULTS = {
    "operator": {
        "cockpit.read",
        "risk.read",
        "business_flow.read",
        "sourcing.read",
        "sourcing.write",
        "selection.read",
        "selection.write",
        "listing.read",
        "listing.write",
        "pricing.read",
        "pricing.write",
        "orders.read",
        "orders.write",
        "operations.read",
        "operations.write",
        "growth.read",
        "competitor.read",
        "inventory.read",
        "reports.read",
        "ai_engine.use",
    },
    "finance": {
        "cockpit.read",
        "risk.read",
        "business_flow.read",
        "orders.read",
        "finance.read",
        "finance.write",
        "operations.read",
        "reports.read",
        "inventory.read",
    },
}


def _load_default_permissions() -> list[dict]:
    path = DATA_DIR / "default_permissions.json"
    return json.loads(path.read_text(encoding="utf-8"))


async def seed_default_permissions(db: AsyncSession) -> None:
    """Seed system permissions and default roles from data files."""
    defaults = _load_default_permissions()
    for item in defaults:
        existing = await db.get(Permission, item["code"])
        if existing:
            existing.module = item["module"]
            existing.action = item["action"]
            existing.resource = item["resource"]
            existing.label = item["label"]
            existing.is_active = True
            continue
        db.add(Permission(**item, is_active=True))

    role_defs = [
        {"code": "owner", "name": "系统拥有者", "data_scope": "all", "is_system": True},
        {"code": "operator", "name": "运营人员", "data_scope": "assigned", "is_system": True},
        {"code": "finance", "name": "财务人员", "data_scope": "assigned", "is_system": True},
    ]
    for item in role_defs:
        result = await db.execute(select(Role).where(Role.code == item["code"]))
        role = result.scalar_one_or_none()
        if role:
            role.name = item["name"]
            role.data_scope = item["data_scope"]
            role.is_active = True
            continue
        db.add(Role(**item, is_active=True))
    await db.flush()

    roles_by_code = {
        item.code: item
        for item in (await db.execute(select(Role).where(Role.code.in_(["owner", "operator", "finance"])))).scalars().all()
    }
    permission_codes = {item["code"] for item in defaults}
    owner = roles_by_code.get("owner")
    if owner:
        await _ensure_role_permissions(db, owner, permission_codes)
    for role_code, default_codes in ROLE_PERMISSION_DEFAULTS.items():
        role = roles_by_code.get(role_code)
        if role:
            await _ensure_role_permissions(db, role, default_codes & permission_codes)
    await db.commit()


async def _ensure_role_permissions(db: AsyncSession, role: Role, permission_codes: Iterable[str]) -> None:
    """Append missing default permissions without removing existing custom grants."""
    if not permission_codes:
        return
    existing = set(
        (
            await db.execute(
                select(RolePermission.permission_code).where(RolePermission.role_id == role.id)
            )
        ).scalars().all()
    )
    for code in sorted(set(permission_codes) - existing):
        db.add(RolePermission(role_id=role.id, permission_code=code))


async def list_user_permissions(db: AsyncSession, user: User) -> list[str]:
    """Return permission codes available to a user."""
    if user.is_admin:
        result = await db.execute(select(Permission.code).where(Permission.is_active == True))
        return sorted(result.scalars().all())

    result = await db.execute(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_code == Permission.code)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .where(UserRole.user_id == user.id, Permission.is_active == True)
    )
    return sorted(set(result.scalars().all()))


async def has_permission(db: AsyncSession, user: User, permission_code: str) -> bool:
    if user.is_admin:
        return True
    return permission_code in await list_user_permissions(db, user)


async def require_permission_code(db: AsyncSession, user: User, permission_code: str) -> None:
    if not await has_permission(db, user, permission_code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "permission_denied", "permission": permission_code},
        )


def require_permission(permission_code: str):
    async def dependency(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        await require_permission_code(db, current_user, permission_code)
        return current_user

    return dependency


async def permission_summary(db: AsyncSession, user: User) -> dict:
    permissions = await list_user_permissions(db, user)
    modules = sorted({code.split(".", 1)[0] for code in permissions})
    return {
        "is_admin": bool(user.is_admin),
        "permissions": permissions,
        "modules": modules,
    }


def has_any_permission(permissions: Iterable[str], required: Iterable[str]) -> bool:
    available = set(permissions)
    return any(item in available for item in required)


async def list_access_control_matrix(db: AsyncSession) -> dict:
    """Return permissions, roles, and user role assignments for admin screens."""
    permissions = list((await db.execute(select(Permission).order_by(Permission.module, Permission.sort_order, Permission.code))).scalars().all())
    roles = list((await db.execute(select(Role).order_by(Role.is_system.desc(), Role.code))).scalars().all())
    role_permissions = list((await db.execute(select(RolePermission))).scalars().all())
    user_roles = list((await db.execute(select(UserRole))).scalars().all())

    perms_by_role: dict[str, list[str]] = {}
    for item in role_permissions:
        perms_by_role.setdefault(item.role_id, []).append(item.permission_code)

    roles_by_user: dict[str, list[str]] = {}
    for item in user_roles:
        roles_by_user.setdefault(item.user_id, []).append(item.role_id)

    return {
        "permissions": [
            {
                "code": item.code,
                "module": item.module,
                "action": item.action,
                "resource": item.resource,
                "label": item.label,
                "description": item.description,
                "is_active": item.is_active,
            }
            for item in permissions
        ],
        "roles": [
            {
                "id": item.id,
                "code": item.code,
                "name": item.name,
                "description": item.description,
                "data_scope": item.data_scope,
                "is_system": item.is_system,
                "is_active": item.is_active,
                "permissions": sorted(perms_by_role.get(item.id, [])),
            }
            for item in roles
        ],
        "user_roles": roles_by_user,
    }


async def replace_user_roles(db: AsyncSession, target_user: User, role_ids: list[str], assigned_by: User) -> list[str]:
    """Replace a user's role assignments and return normalized role ids."""
    unique_role_ids = sorted(set(role_ids))
    if unique_role_ids:
        result = await db.execute(select(Role.id).where(Role.id.in_(unique_role_ids), Role.is_active == True))
        valid_role_ids = sorted(set(result.scalars().all()))
        invalid = sorted(set(unique_role_ids) - set(valid_role_ids))
        if invalid:
            raise ValueError(f"角色不存在或已停用: {', '.join(invalid)}")
    else:
        valid_role_ids = []

    await db.execute(delete(UserRole).where(UserRole.user_id == target_user.id))
    for role_id in valid_role_ids:
        db.add(UserRole(user_id=target_user.id, role_id=role_id, assigned_by=assigned_by.id))
    await db.commit()
    return valid_role_ids

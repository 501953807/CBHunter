"""AI Provider 服务 — 数据库管理 + 用户配置."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.ai_provider import AIProviderDef
from app.models.user import User
from app.services.system_config_service import get_config

DEFAULT_PROVIDERS_PATH = Path(__file__).resolve().parents[1] / "data" / "default_ai_providers.json"


@lru_cache(maxsize=1)
def load_default_providers() -> list[dict]:
    with DEFAULT_PROVIDERS_PATH.open("r", encoding="utf-8") as file:
        providers = json.load(file)
    if not isinstance(providers, list):
        raise ValueError("default_ai_providers.json must contain a list")
    return providers


DEFAULT_PROVIDERS = load_default_providers()


async def seed_providers(db: AsyncSession):
    """Seed and backfill system Provider definitions from the data file."""
    result = await db.execute(select(AIProviderDef))
    existing = {provider.id: provider for provider in result.scalars().all()}
    changed = 0
    for data in DEFAULT_PROVIDERS:
        provider = existing.get(data["id"])
        if not provider:
            db.add(AIProviderDef(**data))
            changed += 1
            continue
        for key, value in data.items():
            if key in ("id", "enabled"):
                continue
            if getattr(provider, key) != value:
                setattr(provider, key, value)
                changed += 1
    if changed:
        await db.commit()


async def list_providers(db: AsyncSession, user_id: Optional[str] = None) -> list[dict]:
    """列出所有 Provider，附带用户的配置状态."""
    result = await db.execute(select(AIProviderDef).order_by(AIProviderDef.priority))
    providers = result.scalars().all()
    user_config = await _get_user_provider_config(db, user_id) if user_id else {}

    items = []
    for p in providers:
        entry = {
            "id": p.id, "name": p.name, "type": p.type,
            "capabilities": p.capabilities, "cost_tier": p.cost_tier,
            "check_cmd": p.check_cmd, "needs_key": p.needs_key,
            "needs_overseas": p.needs_overseas, "description": p.description,
            "priority": p.priority, "enabled": p.enabled,
            "available": await _check_available(db, p),
        }
        # Merge user config
        uc = user_config.get(p.id, {})
        entry["user_enabled"] = uc.get("enabled", True)
        entry["user_priority"] = uc.get("priority", p.priority)
        entry["has_api_key"] = uc.get("has_api_key", False)
        items.append(entry)
    return items


async def create_provider(db: AsyncSession, data: dict) -> AIProviderDef:
    """管理员新增自定义 Provider."""
    p = AIProviderDef(id=data["id"], **{k: v for k, v in data.items() if k != "id"})
    db.add(p)
    await db.commit()
    return p


async def update_provider(db: AsyncSession, provider_id: str, data: dict) -> Optional[AIProviderDef]:
    """管理员编辑 Provider."""
    result = await db.execute(select(AIProviderDef).where(AIProviderDef.id == provider_id))
    p = result.scalar_one_or_none()
    if not p:
        return None
    for k, v in data.items():
        if hasattr(p, k) and v is not None:
            setattr(p, k, v)
    await db.commit()
    return p


async def delete_provider(db: AsyncSession, provider_id: str) -> bool:
    """管理员删除自定义 Provider（默认的不可删）。"""
    if provider_id in [d["id"] for d in DEFAULT_PROVIDERS]:
        return False
    result = await db.execute(delete(AIProviderDef).where(AIProviderDef.id == provider_id))
    await db.commit()
    return result.rowcount > 0


async def save_user_config(db: AsyncSession, user: User, config: dict):
    """保存用户的 Provider 配置（优先级 + Key 标记）."""
    s = user.settings or {}
    s["provider_config"] = config
    user.settings = s
    db.add(user)
    await db.commit()


async def _get_user_provider_config(db: AsyncSession, user_id: str) -> dict:
    """获取用户的 Provider 配置。"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {}
    s = user.settings or {}
    return s.get("provider_config", {})


async def _check_available(db: AsyncSession, p: AIProviderDef) -> bool:
    """检查 Provider 当前是否可用。"""
    import shutil
    if not p.enabled:
        return False
    if p.type == "cli" and p.check_cmd:
        return shutil.which(p.check_cmd.split()[-1]) is not None
    if p.type in ("free_api", "paid_api") and p.needs_key:
        return bool(await get_config(db, p.needs_key))
    if p.type == "rule":
        return True
    return True

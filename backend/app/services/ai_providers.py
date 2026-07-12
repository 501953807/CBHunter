"""AI Provider runtime registry.

Provider definitions are initialized from provider_service.DEFAULT_PROVIDERS so
runtime execution and Settings/database defaults stay aligned.
"""

import logging
import shutil
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_provider_callers import (
    call_claude_cli,
    call_free_api,
    call_ollama,
    call_openclaw,
    call_paid_api,
    call_rule_engine,
)
from app.services.provider_service import DEFAULT_PROVIDERS
from app.services.system_config_service import get_config

logger = logging.getLogger(__name__)

PROVIDERS = {
    provider["id"]: {
        **{key: value for key, value in provider.items() if key != "id"},
        "enabled": provider.get("enabled", True),
    }
    for provider in DEFAULT_PROVIDERS
}


async def get_available_providers(db: AsyncSession) -> list[dict]:
    """Get all providers with current availability."""
    results = []
    for provider_id, cfg in PROVIDERS.items():
        entry = {**cfg, "id": provider_id}
        entry["available"] = await check_provider_available(db, provider_id, cfg)
        results.append(entry)
    return results


async def check_provider_available(db: AsyncSession, pid: str, cfg: dict) -> bool:
    """Check whether a provider is currently available."""
    if not cfg.get("enabled", True):
        return False
    if cfg["type"] == "cli":
        return shutil.which(cfg["check_cmd"].split()[-1]) is not None
    if cfg["type"] in ("free_api", "paid_api"):
        key_field = cfg.get("needs_key", "")
        key = await get_config(db, key_field) if key_field else ""
        return bool(key)
    if cfg["type"] == "rule":
        return True
    return True


async def call_provider(
    db: AsyncSession,
    provider_id: str,
    task_type: str,
    input_data: dict,
    image_path: Optional[str] = None,
) -> dict:
    """Call a selected provider."""
    cfg = PROVIDERS.get(provider_id)
    if not cfg:
        return {"success": False, "error": f"未知 provider: {provider_id}"}

    handler = PROVIDER_HANDLERS.get(provider_id)
    if not handler:
        return {"success": False, "error": f"{provider_id} 未实现调用方法"}

    try:
        return await handler(db, task_type, input_data, image_path)
    except Exception as e:
        logger.warning(f"[{provider_id}] 调用失败: {e}")
        return {"success": False, "error": str(e)}


PROVIDER_HANDLERS = {
    "claude_cli": lambda db, task, data, image: call_claude_cli(task, data, image),
    "openclaw": lambda db, task, data, image: call_openclaw(task, data, image),
    "ollama": lambda db, task, data, image: call_ollama(task, data, image),
    "gemini_free": lambda db, task, data, image: call_free_api(db, PROVIDERS, "gemini_free", task, data, image),
    "deepseek_free": lambda db, task, data, image: call_free_api(db, PROVIDERS, "deepseek_free", task, data, image),
    "tongyi_free": lambda db, task, data, image: call_free_api(db, PROVIDERS, "tongyi_free", task, data, image),
    "doubao_free": lambda db, task, data, image: call_free_api(db, PROVIDERS, "doubao_free", task, data, image),
    "wenxin_free": lambda db, task, data, image: call_free_api(db, PROVIDERS, "wenxin_free", task, data, image),
    "zhipu_free": lambda db, task, data, image: call_free_api(db, PROVIDERS, "zhipu_free", task, data, image),
    "claude_api": lambda db, task, data, image: call_paid_api(db, PROVIDERS, "claude_api", task, data, image),
    "openai_api": lambda db, task, data, image: call_paid_api(db, PROVIDERS, "openai_api", task, data, image),
    "gemini_paid": lambda db, task, data, image: call_paid_api(db, PROVIDERS, "gemini_paid", task, data, image),
    "rule_engine": lambda db, task, data, image: call_rule_engine(task, data, image),
}

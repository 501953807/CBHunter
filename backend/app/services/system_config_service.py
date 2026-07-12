"""Helper to read system configuration from the database.

Used by services that need credentials at runtime (Pinterest fetcher, AI analysis, etc.).
"""

import json
import logging
from pathlib import Path
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.encryption import decrypt

logger = logging.getLogger(__name__)

CONFIG_CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "default_system_configs.json"

SENSITIVE_KEYS = {
    "gemini_api_key",
    "deepseek_api_key",
    "tongyi_api_key",
    "doubao_api_key",
    "wenxin_api_key",
    "zhipu_api_key",
    "anthropic_api_key",
    "openai_api_key",
    "pinterest_account",
}


def is_sensitive_key(key: str) -> bool:
    normalized = key.lower()
    if normalized in SENSITIVE_KEYS:
        return True
    if normalized.startswith("payment."):
        sensitive_tokens = (
            "secret",
            "password",
            "private_key",
            "api_key",
            "api_v3_key",
            "certificate",
            "cert",
            "signature",
        )
        return any(token in normalized for token in sensitive_tokens)
    return False


def get_config_catalog() -> list[dict]:
    data = json.loads(CONFIG_CATALOG_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("default_system_configs.json must contain a list")
    return data


async def get_config(db: AsyncSession, key: str) -> Optional[str]:
    """Read a configuration value from system_config table.

    Handles decryption of sensitive fields automatically.
    Returns None if the key is not configured.
    """
    from app.models.system_config import SystemConfig

    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()
    if not row or not row.value:
        return None

    value = row.value
    if is_sensitive_key(key):
        try:
            value = decrypt(value)
        except Exception as e:
            logger.warning(f"Failed to decrypt {key}: {e}")
            return None

    return value


async def get_pinterest_credentials(db: AsyncSession) -> tuple[Optional[str], Optional[str]]:
    """Get Pinterest login credentials from system_config (combined JSON key)."""
    raw = await get_config(db, "pinterest_account")
    if not raw:
        return None, None
    try:
        data = json.loads(raw)
        return data.get("email"), data.get("password")
    except (json.JSONDecodeError, TypeError, AttributeError):
        logger.warning("Failed to parse pinterest_account config")
        return None, None


async def get_gemini_key(db: AsyncSession) -> Optional[str]:
    """Get Gemini API key from system_config."""
    return await get_config(db, "gemini_api_key")

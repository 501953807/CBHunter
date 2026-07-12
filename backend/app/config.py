import logging
import os
import sys
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    app_name: str = "CBHunter"
    app_version: str = "0.1.0"
    debug: bool = False

    database_url: str = "sqlite+aiosqlite:///./data/shop.db"
    database_echo: bool = False

    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    encryption_key: Optional[str] = None

    # AI Providers — 支持配置多个，按优先级自动选
    # 免费云 API
    gemini_api_key: str = ""
    deepseek_api_key: str = ""
    tongyi_api_key: str = ""
    doubao_api_key: str = ""
    wenxin_api_key: str = ""
    zhipu_api_key: str = ""
    # 付费云 API
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    # 兼容旧配置
    ai_api_key: str = ""  # 旧版兼容，新配 gemini_api_key
    ai_provider: str = "gemini"

    allowed_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

# Startup security checks — refuse to start with insecure defaults
_errors = []

if not settings.secret_key:
    _errors.append(
        "SECRET_KEY 未设置。请在 .env 文件中添加:\n"
        "  SECRET_KEY=<your-random-secret-key>\n"
        "  生成方式: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )

if not settings.encryption_key:
    _errors.append(
        "ENCRYPTION_KEY 未设置。请在 .env 文件中添加:\n"
        "  ENCRYPTION_KEY=<your-fernet-key>\n"
        "  生成方式: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )

if _errors:
    for err in _errors:
        logger.critical(err)
    sys.exit(1)

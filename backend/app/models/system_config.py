"""Unified system config table — replaces .env for credentials & API keys.

Stores all system-level configuration (Gemini API Key, Pinterest credentials, etc.)
in the database so changes take effect immediately without process restart.
Sensitive values are encrypted using the same Fernet cipher as platform accounts.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime

from app.database import Base


class SystemConfig(Base):
    __tablename__ = "system_config"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    label = Column(String(200), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

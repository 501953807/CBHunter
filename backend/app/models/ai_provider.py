"""AI Provider 定义表 — 13个默认 + 管理员自定义."""
from sqlalchemy import Column, String, Text, Boolean, Integer, JSON, DateTime
from datetime import datetime, timezone

from app.database import Base


class AIProviderDef(Base):
    __tablename__ = "ai_provider_defs"

    id = Column(String(50), primary_key=True)  # claude_cli, gemini_free, ...
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)       # cli / free_api / paid_api / rule
    capabilities = Column(JSON, default=list)       # ["vision", "text", "analysis"]
    cost_tier = Column(String(30), nullable=False)
    check_cmd = Column(String(200))                 # which claude
    needs_key = Column(String(50))                  # gemini_api_key
    needs_overseas = Column(Boolean, default=False)
    description = Column(Text)
    priority = Column(Integer, default=999)
    enabled = Column(Boolean, default=True)

    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

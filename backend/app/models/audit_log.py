"""Audit log model for tracking config changes and user actions."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from app.database import Base


def _gen_uuid():
    return str(uuid.uuid4())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    username = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False, index=True)
    resource_id = Column(String(100), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

"""Notification model — persisted alerts for the unified notification center."""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer

from app.database import Base
from app.models.base import gen_uuid


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    type = Column(String(20), nullable=False, index=True)  # alert / report / system
    level = Column(String(10), nullable=False, default="info")  # info / warning / critical
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    link = Column(String(500), nullable=True)  # Frontend route to navigate on click
    read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

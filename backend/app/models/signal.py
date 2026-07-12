"""Unified Signal model — replaces scout.py in-memory _signals list."""
from sqlalchemy import Column, String, Text, Boolean, JSON, DateTime, ForeignKey
from datetime import datetime, timezone

from app.database import Base
from app.models.base import gen_uuid


class Signal(Base):
    __tablename__ = "signals"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False, index=True)

    # Signal classification
    layer = Column(String(20), nullable=False, index=True)     # trend / platform / supply / culture
    source = Column(String(50), nullable=False, default="manual")  # google_trends / shopee / ali1688 / reddit ...

    # Content
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=True)          # Raw text content
    source_url = Column(String(500), nullable=True)
    source_image = Column(String(300), nullable=True)

    # AI analysis
    analysis_status = Column(String(20), default="pending")  # pending / analyzing / completed / failed
    analysis_result = Column(JSON, nullable=True)
    confidence = Column(String(10), nullable=True)  # high / medium / low

    # Conversion tracking
    converted = Column(Boolean, default=False)
    sourcing_item_id = Column(String(36), ForeignKey("sourcing_items.id"), nullable=True)

    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

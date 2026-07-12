from sqlalchemy import Column, String, Float, Boolean, JSON, Text, ForeignKey, TIMESTAMP

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class AISuggestion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ai_suggestions"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    suggestion_type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)
    confidence = Column(Float)
    category = Column(String(100))
    related_entity_type = Column(String(50))
    related_entity_id = Column(String)
    source_refs = Column(JSON, default=list)
    evidence_window = Column(String(100))
    confidence_reason = Column(Text)
    metrics_before = Column(JSON, default=dict)
    metrics_after = Column(JSON, default=dict)
    is_read = Column(Boolean, default=False)
    is_applied = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    applied_at = Column(TIMESTAMP(timezone=True))

"""Persisted handling state for projected risk-control events."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text, UniqueConstraint

from app.database import Base


def _gen_uuid():
    return str(uuid.uuid4())


class RiskEventState(Base):
    __tablename__ = "risk_event_states"
    __table_args__ = (
        UniqueConstraint("user_id", "risk_id", name="uq_risk_event_states_user_risk"),
    )

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    risk_id = Column(String(160), nullable=False, index=True)
    risk_type = Column(String(40), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    severity = Column(String(20), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    assigned_to = Column(String(100), nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True)
    note = Column(Text, nullable=True)
    last_detail = Column(Text, nullable=True)
    route = Column(String(160), nullable=False)
    evidence_window = Column(String(120), nullable=True)
    source_refs = Column(JSON, default=list)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

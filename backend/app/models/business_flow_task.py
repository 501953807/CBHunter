"""Persistent task ownership for business-flow item handling."""

from sqlalchemy import Boolean, Column, JSON, String, Text, UniqueConstraint

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class BusinessFlowTask(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "business_flow_tasks"
    __table_args__ = (
        UniqueConstraint("user_id", "item_type", "item_id", name="uq_business_flow_task_item"),
    )

    user_id = Column(String(36), nullable=False, index=True)
    item_type = Column(String(60), nullable=False, index=True)
    item_id = Column(String(80), nullable=False, index=True)
    stage_key = Column(String(40), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    route = Column(String(200), nullable=False)
    status = Column(String(30), nullable=False, index=True)
    priority = Column(String(20), nullable=False)
    assigned_to = Column(String(100), nullable=True, index=True)
    followed_by = Column(JSON, nullable=False, default=list)
    source_refs = Column(JSON, nullable=False, default=list)
    last_gap = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

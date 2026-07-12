"""Independent operating records that can post verified amounts to finance."""

from sqlalchemy import Column, DateTime, Float, ForeignKey, JSON, String, Text

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class OperationRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "operation_records"

    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    record_type = Column(String(50), nullable=False, index=True)
    status = Column(String(30), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    platform = Column(String(50), nullable=True, index=True)
    market = Column(String(20), nullable=True, index=True)
    counterparty = Column(String(255), nullable=True)
    planned_amount_rmb = Column(Float, nullable=True)
    actual_amount_rmb = Column(Float, nullable=True)
    currency = Column(String(10), nullable=False, default="CNY")
    due_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    metrics = Column(JSON, default=dict)
    extra = Column(JSON, default=dict)
    ledger_entry_id = Column(String(36), ForeignKey("finance_ledger_entries.id"), nullable=True, index=True)

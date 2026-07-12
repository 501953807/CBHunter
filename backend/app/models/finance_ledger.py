"""Finance ledger entries for real cost, revenue, and cash tracking."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, JSON, String, Text

from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class FinanceLedgerEntry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "finance_ledger_entries"

    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    entry_type = Column(String(50), nullable=False, index=True)
    amount_rmb = Column(Float, nullable=False)
    amount_original = Column(Float, nullable=True)
    currency = Column(String(10), nullable=False, default="CNY")
    platform = Column(String(50), nullable=True, index=True)
    market = Column(String(20), nullable=True, index=True)
    order_id = Column(String(36), nullable=True, index=True)
    sourcing_item_id = Column(String(36), nullable=True, index=True)
    description = Column(Text, nullable=True)
    extra = Column(JSON, default=dict)
    occurred_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

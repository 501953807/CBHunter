"""Inventory alert models — rules + alert log."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey
from app.database import Base


def _gen_uuid():
    return str(uuid.uuid4())


class InventoryAlertRule(Base):
    __tablename__ = "inventory_alert_rules"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False, index=True)
    sku = Column(String(100), nullable=False)
    product_name = Column(String(500), nullable=False)
    safety_stock = Column(Integer, nullable=False, default=10)
    enabled = Column(Boolean, default=True)
    severity = Column(String(10), default="warning")  # info / warning / critical
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class InventoryAlertLog(Base):
    __tablename__ = "inventory_alert_logs"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    rule_id = Column(String(36), ForeignKey("inventory_alert_rules.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False, index=True)
    sku = Column(String(100), nullable=False)
    product_name = Column(String(500), nullable=False)
    current_stock = Column(Integer, nullable=False)
    threshold = Column(Integer, nullable=False)
    severity = Column(String(10), nullable=False)
    status = Column(String(20), default="open")  # open / acknowledged / cleared
    acknowledged_by = Column(String(100), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    cleared_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

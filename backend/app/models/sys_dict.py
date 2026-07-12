"""System dictionary — platforms, markets, categories stored in DB, admin-managed."""
from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime
from datetime import datetime, timezone

from app.database import Base


class SysDictItem(Base):
    """System dictionary item. type = 'platform' | 'market' | 'category'."""
    __tablename__ = "sys_dict_items"

    id = Column(String(50), primary_key=True)     # market: "MY", category: "bags", platform: "shopee"
    type = Column(String(20), nullable=False, index=True)  # platform / market / category
    label = Column(String(100), nullable=False)
    extra = Column(JSON, default=dict)  # platform: {icon, color}, market: {flag}, category: {keywords}
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

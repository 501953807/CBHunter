from sqlalchemy import Column, String, JSON, Date, ForeignKey

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin


class AnalyticsSnapshot(UUIDMixin, Base):
    __tablename__ = "analytics_snapshots"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    platform_account_id = Column(String, ForeignKey("platform_accounts.id"), nullable=True)
    snapshot_date = Column(Date, nullable=False)
    period_type = Column(String(10), nullable=False)  # daily, weekly, monthly
    metrics = Column(JSON, nullable=False)

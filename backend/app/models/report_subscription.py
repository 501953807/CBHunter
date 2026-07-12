"""Report subscription model."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from app.database import Base


def _gen_uuid():
    return str(uuid.uuid4())


class ReportSubscription(Base):
    __tablename__ = "report_subscriptions"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    channel = Column(String(20), nullable=False)  # email / dingtalk / feishu
    frequency = Column(String(20), nullable=False)  # daily / weekly / monthly
    enabled = Column(Boolean, default=True)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

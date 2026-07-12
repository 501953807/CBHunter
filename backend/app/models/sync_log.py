from sqlalchemy import Column, String, Integer, JSON, Text, ForeignKey, TIMESTAMP

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin


class SyncLog(UUIDMixin, Base):
    __tablename__ = "sync_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False, index=True)
    platform_account_id = Column(String, ForeignKey("platform_accounts.id"), nullable=False, index=True)
    sync_type = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False)  # running, success, failed, partial
    started_at = Column(TIMESTAMP(timezone=True), nullable=False)
    completed_at = Column(TIMESTAMP(timezone=True))
    duration_seconds = Column(Integer)
    records_processed = Column(Integer, default=0)
    records_created = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    error_message = Column(Text)
    error_details = Column(JSON, default=list)

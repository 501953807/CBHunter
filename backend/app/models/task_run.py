"""Model for tracking task execution history."""
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime

from app.database import Base
from app.models.base import gen_uuid


class TaskRun(Base):
    __tablename__ = "task_runs"

    id = Column(String, primary_key=True, default=gen_uuid)
    task_id = Column(String(100), nullable=False, index=True)
    task_name = Column(String(200))
    status = Column(String(20), default="running")  # running / success / skipped / partial_failed / failed
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

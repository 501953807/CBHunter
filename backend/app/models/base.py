import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.sqlite import TEXT as SA_TEXT
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class UUIDMixin:
    id = Column(SA_TEXT, primary_key=True, default=gen_uuid)

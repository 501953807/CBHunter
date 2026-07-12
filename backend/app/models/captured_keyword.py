"""Model for user-captured trend keywords — persistent selection history.

Separate from trend_keywords so that sync (DELETE ALL + INSERT on trend_keywords)
never touches the user's captured history. Each row is a snapshot of the keyword
data at the time it was captured.
"""

from sqlalchemy import Column, String, Float, Integer, JSON, DateTime, Boolean
from datetime import datetime, timezone

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class CapturedKeyword(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "captured_keywords"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=True, index=True)

    # Keyword and context — captured from trend card wall
    keyword = Column(String(200), nullable=False)
    market = Column(String(20), nullable=True, index=True)
    category = Column(String(100), nullable=True, index=True)

    # Snapshot of trend data at capture time (frozen, won't change on sync)
    search_volume = Column(Integer)
    trend_direction = Column(String(20))
    growth_pct = Column(Float)
    competition_level = Column(String(20))
    trend_data = Column(JSON, default=list)

    # Source of this capture
    source = Column(String(50), default="manual")

    # Pinterest snapshot (if available at capture time)
    pinterest_volume = Column(Integer, nullable=True)
    pinterest_direction = Column(String(20), nullable=True)
    pinterest_growth = Column(Float, nullable=True)
    pinterest_trend_data = Column(JSON, default=list)
    has_pinterest_data = Column(Boolean, default=False)

    # Cross-validation snapshot
    cross_validation_score = Column(Integer, nullable=True)
    cross_validation_detail = Column(JSON, nullable=True)
    cross_validated_at = Column(DateTime(timezone=True), nullable=True)

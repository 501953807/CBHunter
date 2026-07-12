"""Model for tracking trend keywords across markets and categories."""

from sqlalchemy import Column, String, Float, Integer, JSON, DateTime, Boolean
from datetime import datetime, timezone

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class TrendKeyword(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "trend_keywords"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=True, index=True)  # NULL = system-wide trends

    # Keyword and context
    keyword = Column(String(200), nullable=False)
    market = Column(String(20), nullable=True, index=True)  # MY, PH, SG, TH, VN, ID
    category = Column(String(100), nullable=True, index=True)

    # Trend data (last fetched)
    search_volume = Column(Integer)  # Actual volume only; normalized trend index stays in trend_data
    trend_direction = Column(String(20))  # rising, falling, stable, seasonal
    growth_pct = Column(Float)  # Growth percentage over last period
    competition_level = Column(String(20))  # low, medium, high

    # Time series data (stored as JSON array of {date, value})
    trend_data = Column(JSON, default=list)

    # Related terms
    related_top = Column(JSON, default=list)  # Top related queries
    related_rising = Column(JSON, default=list)  # Rising related queries

    # Source of this data
    source = Column(String(50), default="manual")  # manual, google_trends, pinterest, pinterest_cross

    # Pinterest-specific trend data
    pinterest_volume = Column(Integer, nullable=True)
    pinterest_direction = Column(String(20), nullable=True)
    pinterest_growth = Column(Float, nullable=True)
    pinterest_trend_data = Column(JSON, default=list)
    has_pinterest_data = Column(Boolean, default=False)

    # Cross-validation data (Google + Pinterest)
    cross_validation_score = Column(Integer, nullable=True)  # 0-100
    cross_validation_detail = Column(JSON, nullable=True)    # match_type, windows details
    cross_validated_at = Column(DateTime(timezone=True), nullable=True)

    # Fetch status
    last_fetched_at = Column(DateTime(timezone=True))

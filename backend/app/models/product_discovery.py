"""Model for tracking product discoveries through the selection pipeline.

Records a product from initial discovery (image upload / manual entry),
through trend analysis, profitability check, to final decision.
"""

from sqlalchemy import Column, String, Float, Integer, JSON, Text, DateTime, Boolean
from datetime import datetime, timezone

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class ProductDiscovery(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "product_discoveries"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False, index=True)

    # Source
    source_type = Column(String(30), default="image_upload")  # image_upload, manual, shopee_browse, tiktok
    source_image = Column(String(500))  # Path to uploaded image
    source_url = Column(Text)  # Original URL if from web

    # Product identification
    product_name = Column(String(500))
    product_type = Column(String(100))  # e.g., "tote_bag", "crossbody_bag"
    category = Column(String(100))
    market = Column(String(20))  # Target market

    # Extracted features (from image analysis + user input)
    features = Column(JSON, default=list)     # Material, size, color, style
    selling_points = Column(JSON, default=list)  # Key differentiators
    target_audience = Column(String(200))

    # Full AI analysis result
    full_analysis = Column(JSON, default=dict)

    # Trend analysis
    matched_trend_keywords = Column(JSON, default=list)  # [{keyword, score}]
    trend_score = Column(Float)  # 0-100, null when no trend evidence exists
    market_demand = Column(String(20))  # high, medium, low, unknown

    # Financial analysis
    sourcing_price_rmb = Column(Float)  # 1688 price
    suggested_price_local = Column(Float)  # Suggested selling price
    estimated_profit_margin = Column(Float)

    # Pipeline
    status = Column(String(30), default="discovered", index=True)
    # discovered → trend_analyzed → priced → decision_made → sourcing → listed

    # Decision
    decision = Column(String(30), index=True)  # pursue, maybe, reject
    decision_reason = Column(Text)
    decided_at = Column(DateTime(timezone=True))

    # Notes
    notes = Column(Text)
    tags = Column(JSON, default=list)

    # Timestamps
    analyzed_at = Column(DateTime(timezone=True))

from sqlalchemy import Column, String, Integer, Float, JSON, ForeignKey, TIMESTAMP

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin


class MarketResearch(UUIDMixin, Base):
    __tablename__ = "market_research"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    keyword = Column(String(500), nullable=False)
    platform = Column(String(20), nullable=False)
    search_volume = Column(Integer)
    competition_level = Column(String(20))
    avg_price = Column(Float)
    total_results = Column(Integer)
    related_keywords = Column(JSON, default=list)
    trend_data = Column(JSON, default=list)
    analyzed_at = Column(TIMESTAMP(timezone=True), nullable=False)

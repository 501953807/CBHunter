from sqlalchemy import Column, String, Float, Integer, Boolean, JSON, Text, ForeignKey, TIMESTAMP

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin


class CompetitorProduct(UUIDMixin, Base):
    __tablename__ = "competitor_products"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    platform = Column(String(20), nullable=False)
    platform_product_id = Column(String(200))
    name = Column(String(500), nullable=False)
    seller_name = Column(String(200))
    price = Column(Float)
    currency = Column(String(3))
    market = Column(String(20))
    collection_method = Column(String(30))
    confidence_level = Column(String(20))
    sales_estimate = Column(Integer)
    rating = Column(Float)
    review_count = Column(Integer)
    url = Column(String(1000))
    notes = Column(Text)
    is_tracked = Column(Boolean, default=True)
    price_history = Column(JSON, default=list)
    last_updated = Column(TIMESTAMP(timezone=True), nullable=False)

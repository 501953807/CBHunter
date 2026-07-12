from sqlalchemy import Column, String, Float, Integer, JSON, TIMESTAMP
from app.database import Base
from app.models.base import gen_uuid, UUIDMixin


class CapturedTrendingProduct(UUIDMixin, Base):
    __tablename__ = "captured_trending_products"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False, index=True, default="")
    platform = Column(String(20), nullable=False, index=True)
    platform_product_id = Column(String(200))
    name = Column(String(500), nullable=False)
    price_min = Column(Float)
    price_max = Column(Float)
    price_cny = Column(Float)
    sales_volume = Column(Integer)
    sales_growth_rate = Column(Float)
    category_path = Column(String(500))
    market = Column(String(10), default="")
    images = Column(JSON, default=list)
    sku = Column(String(200), default="")
    product_url = Column(String(1000), default="")
    shop_name = Column(String(200), default="")
    rating = Column(Float)
    tags = Column(JSON, default=list)
    snapshot_data = Column(JSON, default=dict)
    discovered_at = Column(TIMESTAMP(timezone=True), nullable=False)
    last_updated = Column(TIMESTAMP(timezone=True), nullable=False)

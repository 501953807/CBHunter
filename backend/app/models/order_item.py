from sqlalchemy import Column, String, Integer, Float, JSON, ForeignKey

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin


class OrderItem(UUIDMixin, Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, default=gen_uuid)
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    platform_listing_id = Column(String, ForeignKey("platform_listings.id"), nullable=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=True)
    sku = Column(String(100))
    name = Column(String(500), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    variation_info = Column(JSON)
    platform_data = Column(JSON, default=dict)

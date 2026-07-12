from sqlalchemy import Column, String, Float, Integer, JSON, ForeignKey, TIMESTAMP

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class PlatformListing(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "platform_listings"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    platform_account_id = Column(String, ForeignKey("platform_accounts.id"), nullable=False, index=True)
    platform_product_id = Column(String(200))
    platform_category_id = Column(String(100))
    title = Column(String(500), nullable=False)
    description = Column(String)
    price = Column(Float, nullable=False)
    compare_at_price = Column(Float)
    stock = Column(Integer, nullable=False, default=0)
    variations = Column(JSON, default=list)
    images = Column(JSON, default=list)
    shipping_config = Column(JSON, default=dict)
    status = Column(String(20), nullable=False)  # draft, pending, active, paused, rejected, blocked, deleted
    listing_url = Column(String(1000))
    performance = Column(JSON, default=dict)
    platform_data = Column(JSON, default=dict)
    last_synced_at = Column(TIMESTAMP(timezone=True))

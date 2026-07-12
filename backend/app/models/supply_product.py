"""Model for 1688 supply chain products collected via Chrome extension."""

from sqlalchemy import Column, String, Float, Integer, JSON, Text, DateTime, Boolean
from datetime import datetime, timezone

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class SupplyProduct(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "supply_products"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False, index=True)

    # Product identity
    platform = Column(String(20), default="ali1688")
    platform_product_id = Column(String(200))
    name = Column(String(500), nullable=False)
    sku = Column(String(200))
    category_path = Column(String(200))

    # Pricing (RMB)
    price_min = Column(Float)
    price_max = Column(Float)
    price_range_text = Column(String(100))

    # Supplier info
    shop_name = Column(String(300))
    shop_url = Column(String(500))
    supplier_rating = Column(String(50))

    # Product details
    sales_volume = Column(Integer)
    moq = Column(Integer)  # Minimum order quantity
    rating = Column(Float)
    images = Column(JSON, default=list)
    product_url = Column(String(500))
    tags = Column(JSON, default=list)

    # Market
    market = Column(String(20), default="CN")

    # Source tracking
    source = Column(String(50), default="browser_ext")  # browser_ext, manual
    snapshot_data = Column(JSON, default=dict)
    notes = Column(Text)

    # Status
    is_active = Column(Boolean, default=True)
    added_to_discovery = Column(Boolean, default=False)
    discovery_id = Column(String, nullable=True)

    # Timestamps
    discovered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_updated = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

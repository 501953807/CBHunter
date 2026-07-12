from sqlalchemy import Column, Float, ForeignKey, Integer, JSON, String, DateTime

from app.models.base import TimestampMixin, UUIDMixin
from app.database import Base


class PromotionCampaign(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "promotion_campaigns"

    user_id = Column(String, nullable=False, index=True)
    platform_account_id = Column(String, ForeignKey("platform_accounts.id"), nullable=False, index=True)
    platform = Column(String(50), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    promotion_type = Column(String(50), nullable=False, default="discount")
    status = Column(String(30), nullable=False, default="draft")
    starts_at = Column(DateTime(timezone=True))
    ends_at = Column(DateTime(timezone=True))
    external_promotion_id = Column(String(200))
    stack_rule = Column(String(100))
    source = Column(String(50), nullable=False, default="local")
    metrics = Column(JSON, default=dict)
    platform_data = Column(JSON, default=dict)


class PromotionCampaignItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "promotion_campaign_items"

    user_id = Column(String, nullable=False, index=True)
    campaign_id = Column(String, ForeignKey("promotion_campaigns.id"), nullable=False, index=True)
    platform_listing_id = Column(String, ForeignKey("platform_listings.id"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    sku = Column(String(200))
    discount_type = Column(String(50), nullable=False, default="percentage")
    discount_value = Column(Float)
    original_price = Column(Float)
    promotion_price = Column(Float)
    stock_limit = Column(Integer)
    status = Column(String(30), nullable=False, default="planned")
    platform_data = Column(JSON, default=dict)

"""Model for tracking suppliers linked to sourcing items."""

from sqlalchemy import Column, String, Integer, Float, Text, ForeignKey, Boolean

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class SourcingSupplier(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sourcing_suppliers"

    id = Column(String, primary_key=True, default=gen_uuid)
    sourcing_item_id = Column(String, ForeignKey("sourcing_items.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)

    supplier_name = Column(String(200), nullable=False)  # Vendor/shop name
    supplier_url = Column(Text)  # Link to product page
    product_image = Column(String(500))  # Supplier's product image
    purchase_price_rmb = Column(Float)  # 采购价 (RMB)
    shipping_estimate_rmb = Column(Float)  # Estimated shipping cost
    moq = Column(Integer)  # Minimum order quantity, unknown until captured
    notes = Column(Text)
    rating = Column(String(20))  # 好评率, star rating etc.

    is_preferred = Column(Boolean, default=False)

    # Multi-dimension supplier scoring (0-100 each)
    quality_score = Column(Integer)        # 质量评分
    delivery_score = Column(Integer)       # 交货准时率
    price_score = Column(Integer)          # 价格竞争力
    communication_score = Column(Integer)  # 沟通响应
    certification_score = Column(Integer)  # 资质认证
    overall_score = Column(Float)          # 综合评分(auto-calculated)

"""Model for tracking product sourcing candidates across platforms.

Tracks products from discovery (on 1688 etc.) through JIT testing
to full VMI/listing deployment.
"""

from sqlalchemy import Column, String, Float, Integer, JSON, Text, DateTime, Boolean
from datetime import datetime, timezone

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class SourcingItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sourcing_items"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False, index=True)

    # Source info
    source_name = Column(String(50), nullable=False, default="1688")  # 1688, taobao, pinduoduo, etc.
    source_url = Column(Text)  # Link to product on sourcing platform
    source_price_rmb = Column(Float)  # Purchase price in RMB, unknown until captured
    product_name = Column(String(500), nullable=False)
    product_name_cn = Column(String(500))  # Chinese name

    # Product specs
    weight_g = Column(Float)  # Weight in grams
    category = Column(String(100))  # Target category
    platform = Column(String(50), index=True)  # Target platform (shopee, tiktok, temu)
    market = Column(String(50))  # Target market (philippines, malaysia, etc.)

    # Pipeline status
    # For TEMU: discovery -> jit_testing -> jit_passed -> vmi -> active
    # For Shopee/TikTok: discovery -> listed -> active
    pipeline_stage = Column(String(30), nullable=False, default="discovery", index=True)

    # TEMU-specific statuses
    price_review_status = Column(String(20))  # pending, approved, rejected, not_submitted
    price_review_note = Column(Text)
    jit_stock = Column(Integer, default=0)
    vmi_stock = Column(Integer, default=0)

    # Actual selling info
    selling_price_local = Column(Float)  # Final selling price in local currency
    monthly_sales = Column(Integer)
    profit_margin_pct = Column(Float)  # Actual profit margin

    # Cost breakdown (RMB)
    domestic_shipping_rmb = Column(Float)   # 国内运费
    intl_shipping_rmb = Column(Float)       # 国际运费
    packaging_cost_rmb = Column(Float)      # 包装费
    platform_fee_pct = Column(Float)        # 平台佣金率(%)
    payment_fee_pct = Column(Float)         # 支付手续费率(%)
    return_reserve_pct = Column(Float)      # 退损预留率(%)
    exchange_rate = Column(Float)           # 汇率(1RMB=?当地货币)
    total_cost_rmb = Column(Float)          # 总成本RMB(计算值)
    listing_url = Column(String(500), nullable=True)      # 上架链接

    # Image
    source_image = Column(String(500))  # Product image path

    # Extra data from discovery (titles, market recs, etc.)
    extra_data = Column(JSON, default=dict)

    # Notes & tags
    notes = Column(Text)
    tags = Column(JSON, default=list)  # e.g., ["引流款", "利润款", "应季"]

    # Status
    is_active = Column(Boolean, default=True)

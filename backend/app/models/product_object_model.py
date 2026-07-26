"""V5 product object model: base versions, SKU variants, and platform field validations."""

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, JSON, String, Text

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class ProductBaseVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "product_base_versions"

    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    version_no = Column(Integer, nullable=False, default=1)
    version_name = Column(String(120), nullable=False, default="基础版本")
    source = Column(String(50), nullable=False, default="manual")
    title = Column(String(500), nullable=False)
    description = Column(Text)
    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    brand = Column(String(200))
    attributes = Column(JSON, nullable=False, default=dict)
    images = Column(JSON, nullable=False, default=list)
    package = Column(JSON, nullable=False, default=dict)
    content = Column(JSON, nullable=False, default=dict)
    status = Column(String(30), nullable=False, default="active", index=True)
    change_reason = Column(Text)


class ProductSkuVariant(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "product_sku_variants"

    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    base_version_id = Column(String, ForeignKey("product_base_versions.id"), nullable=True, index=True)
    platform_listing_id = Column(String, ForeignKey("platform_listings.id"), nullable=True, index=True)
    scope = Column(String(30), nullable=False, default="base", index=True)  # base, listing_override
    merchant_sku = Column(String(200), nullable=False, index=True)
    platform_sku = Column(String(200))
    spu = Column(String(200))
    skc = Column(String(200))
    option_1_name = Column(String(100))
    option_1_value = Column(String(200))
    option_2_name = Column(String(100))
    option_2_value = Column(String(200))
    sku_image_url = Column(String(1000))
    price = Column(Float)
    stock = Column(Integer, nullable=False, default=0)
    weight_g = Column(Float)
    dimensions = Column(JSON, nullable=False, default=dict)
    attributes = Column(JSON, nullable=False, default=dict)
    enabled = Column(Boolean, nullable=False, default=True)


class PlatformFieldValidation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "platform_field_validations"

    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    platform_listing_id = Column(String, ForeignKey("platform_listings.id"), nullable=True, index=True)
    platform = Column(String(50), nullable=False, index=True)
    market = Column(String(20), nullable=True, index=True)
    platform_account_id = Column(String, ForeignKey("platform_accounts.id"), nullable=True, index=True)
    category_id = Column(String(120))
    field_key = Column(String(120), nullable=False, index=True)
    platform_field_name = Column(String(200))
    data_type = Column(String(50), nullable=False, default="string")
    requirement_level = Column(String(30), nullable=False, default="optional")
    state = Column(String(30), nullable=False, default="missing", index=True)
    current_value = Column(JSON)
    issue_code = Column(String(100))
    message = Column(Text)
    source = Column(String(50), nullable=False, default="dictionary")
    evidence = Column(JSON, nullable=False, default=dict)

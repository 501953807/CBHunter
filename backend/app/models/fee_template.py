"""Fee template model — platform fee configuration per market."""

from sqlalchemy import Column, String, Float, Boolean, DateTime, func
from app.database import Base
import uuid


class FeeTemplate(Base):
    __tablename__ = "fee_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    platform = Column(String(20), nullable=False, index=True)  # shopee, tiktok, temu
    market = Column(String(10), nullable=False, index=True)     # MY, PH, SG, etc.
    commission_pct = Column(Float, default=0.0)    # Platform commission %
    transaction_fee_pct = Column(Float, default=0.0)  # Payment processing fee %
    tech_service_pct = Column(Float, default=0.0)   # Tech/service fee %
    shipping_subsidy = Column(Float, default=0.0)   # Platform shipping subsidy
    free_shipping_threshold = Column(Float, default=0.0)  # Free shipping min order
    min_withdrawal = Column(Float, default=0.0)    # Minimum withdrawal amount
    vat_pct = Column(Float, default=0.0)           # VAT/GST rate
    notes = Column(String(500), default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

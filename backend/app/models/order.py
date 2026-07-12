from sqlalchemy import Column, String, Float, JSON, Text, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class Order(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    platform_account_id = Column(String, ForeignKey("platform_accounts.id"), nullable=False, index=True)
    platform_order_id = Column(String(200), nullable=False)
    order_number = Column(String(100))
    status = Column(String(30), nullable=False, index=True)
    buyer_name = Column(String(200))
    buyer_notes = Column(Text)
    shipping_address = Column(JSON)
    subtotal = Column(Float)
    shipping_fee = Column(Float)
    platform_fee = Column(Float)
    discount = Column(Float)
    total = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="CNY")
    payment_status = Column(String(30))
    payment_method = Column(String(100))
    fulfillment_status = Column(String(30))
    notes = Column(Text)
    platform_data = Column(JSON, default=dict)
    ordered_at = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    last_synced_at = Column(TIMESTAMP(timezone=True))

    items = relationship("OrderItem", backref="order", lazy="selectin")
    platform_account = relationship("PlatformAccount", lazy="joined")

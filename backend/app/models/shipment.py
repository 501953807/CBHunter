from sqlalchemy import Column, String, Float, JSON, Date, ForeignKey, TIMESTAMP

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class Shipment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "shipments"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False, index=True)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, index=True)
    platform_account_id = Column(String, ForeignKey("platform_accounts.id"), nullable=False)
    tracking_number = Column(String(200), index=True)
    carrier = Column(String(100))
    shipping_method = Column(String(100))
    status = Column(String(30), nullable=False)
    origin_address = Column(JSON)
    destination_address = Column(JSON)
    actual_weight_g = Column(Float)
    volumetric_weight_g = Column(Float)
    shipping_cost = Column(Float)
    estimated_delivery_date = Column(Date)
    actual_delivery_date = Column(Date)
    tracking_events = Column(JSON, default=list)
    platform_data = Column(JSON, default=dict)
    last_synced_at = Column(TIMESTAMP(timezone=True))

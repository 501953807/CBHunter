"""Exchange rate model — historical CNY to market currency rates."""

from sqlalchemy import Column, String, Float, DateTime, func
from app.database import Base
import uuid


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    from_currency = Column(String(10), nullable=False, default="CNY")
    to_currency = Column(String(10), nullable=False, index=True)  # MYR, PHP, SGD, etc.
    rate = Column(Float, nullable=False)  # 1 CNY = ? target
    source = Column(String(50), default="exchangerate-api")  # Data source
    fetched_at = Column(DateTime, server_default=func.now(), index=True)

from sqlalchemy import Column, String, Integer, Float, JSON, Text, ForeignKey

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class Product(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(500), nullable=False)
    description = Column(Text)
    brand = Column(String(200))
    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    cost_price = Column(Float)
    weight_g = Column(Float)
    dimensions = Column(JSON)
    attributes = Column(JSON, nullable=False, default=dict)
    images = Column(JSON, nullable=False, default=list)
    tags = Column(JSON, default=list)
    status = Column(String(20), nullable=False, default="draft", index=True)  # draft, active, inactive, archived
    notes = Column(Text)

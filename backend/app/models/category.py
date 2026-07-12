from sqlalchemy import Column, String, Integer, ForeignKey

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin


class Category(UUIDMixin, Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    parent_id = Column(String, ForeignKey("categories.id"), nullable=True, index=True)
    platform = Column(String(20), nullable=True)
    platform_category_id = Column(String(100))
    path = Column(String)
    sort_order = Column(Integer, default=0)

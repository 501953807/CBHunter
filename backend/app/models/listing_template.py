from sqlalchemy import Column, String, Boolean, JSON, Text, ForeignKey

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class ListingTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "listing_templates"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    platform = Column(String(20), nullable=False)
    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    template_data = Column(JSON, nullable=False)
    is_default = Column(Boolean, default=False)

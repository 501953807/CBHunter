"""User-owned image and video assets produced by the content factory."""

from sqlalchemy import Column, Float, ForeignKey, Integer, JSON, String

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class ContentAsset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "content_assets"

    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    asset_type = Column(String(20), nullable=False, index=True)
    original_name = Column(String(255), nullable=True)
    stored_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    operation = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="ready")
    extra = Column(JSON, default=dict)

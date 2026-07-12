from sqlalchemy import Column, String, Boolean, JSON, ForeignKey, TIMESTAMP

from app.database import Base
from app.models.base import gen_uuid, UUIDMixin, TimestampMixin


class PlatformAccount(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "platform_accounts"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    platform = Column(String(20), nullable=False)  # shopee, tiktok, temu
    account_name = Column(String(200), nullable=False)
    shop_id = Column(String(100))
    api_key_encrypted = Column(String)
    api_secret_encrypted = Column(String)
    access_token_encrypted = Column(String)
    refresh_token_encrypted = Column(String)
    token_expires_at = Column(TIMESTAMP(timezone=True))
    token_scopes = Column(JSON)
    is_active = Column(Boolean, default=True, nullable=False)
    settings = Column(JSON, nullable=False, default=dict)
    last_sync_at = Column(TIMESTAMP(timezone=True))

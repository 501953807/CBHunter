"""Access control, store membership, and third-party identity models."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class Permission(Base):
    __tablename__ = "permissions"

    code = Column(String(120), primary_key=True)
    module = Column(String(50), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    resource = Column(String(80), nullable=False)
    label = Column(String(120), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=1000, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class Role(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    code = Column(String(80), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    data_scope = Column(String(30), default="own", nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    settings = Column(JSON, default=dict, nullable=False)


class RolePermission(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_code", name="uq_role_permission"),)

    role_id = Column(String, ForeignKey("roles.id"), nullable=False, index=True)
    permission_code = Column(String(120), ForeignKey("permissions.code"), nullable=False, index=True)


class UserRole(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    role_id = Column(String, ForeignKey("roles.id"), nullable=False, index=True)
    assigned_by = Column(String, ForeignKey("users.id"), nullable=True)


class StoreMember(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "store_members"
    __table_args__ = (UniqueConstraint("platform_account_id", "user_id", name="uq_store_member_user"),)

    platform_account_id = Column(String, ForeignKey("platform_accounts.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    store_role = Column(String(40), default="operator", nullable=False)
    data_scope = Column(String(30), default="store", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    permissions = Column(JSON, default=list, nullable=False)


class UserIdentity(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "user_identities"
    __table_args__ = (UniqueConstraint("provider", "openid", name="uq_identity_provider_openid"),)

    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String(40), nullable=False, index=True)
    openid = Column(String(120), nullable=False)
    unionid = Column(String(120), nullable=True, index=True)
    nickname = Column(String(120), nullable=True)
    avatar_url = Column(Text, nullable=True)
    bound_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

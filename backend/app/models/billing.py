"""Commercial billing, subscription, entitlement, and quota models."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    code = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    price_cents = Column(Integer, default=0, nullable=False)
    currency = Column(String(10), default="CNY", nullable=False)
    billing_cycle = Column(String(20), default="month", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=1000, nullable=False)
    metadata_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class PlanEntitlement(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "plan_entitlements"
    __table_args__ = (UniqueConstraint("plan_code", "feature_code", name="uq_plan_feature"),)

    plan_code = Column(String(50), ForeignKey("subscription_plans.code"), nullable=False, index=True)
    feature_code = Column(String(100), nullable=False, index=True)
    feature_name = Column(String(120), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    limit_value = Column(Integer, nullable=True)
    unit = Column(String(30), nullable=True)
    metadata_json = Column(JSON, default=dict, nullable=False)


class TenantSubscription(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tenant_subscriptions"

    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    plan_code = Column(String(50), ForeignKey("subscription_plans.code"), nullable=False, index=True)
    status = Column(String(30), default="active", nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(40), default="system", nullable=False)
    external_subscription_id = Column(String(120), nullable=True)


class PaymentOrder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "payment_orders"

    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    plan_code = Column(String(50), ForeignKey("subscription_plans.code"), nullable=False, index=True)
    channel = Column(String(30), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(10), default="CNY", nullable=False)
    status = Column(String(30), default="pending", nullable=False, index=True)
    external_order_id = Column(String(120), nullable=True, index=True)
    subject = Column(String(160), nullable=False)
    metadata_json = Column(JSON, default=dict, nullable=False)


class PaymentTransaction(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "payment_transactions"

    order_id = Column(String, ForeignKey("payment_orders.id"), nullable=False, index=True)
    channel = Column(String(30), nullable=False)
    transaction_no = Column(String(120), nullable=True, index=True)
    status = Column(String(30), nullable=False, index=True)
    paid_cents = Column(Integer, default=0, nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    raw_payload = Column(JSON, default=dict, nullable=False)


class PaymentCallback(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "payment_callbacks"

    channel = Column(String(30), nullable=False, index=True)
    event_type = Column(String(80), nullable=False)
    external_order_id = Column(String(120), nullable=True, index=True)
    signature_valid = Column(Boolean, default=False, nullable=False)
    processed = Column(Boolean, default=False, nullable=False)
    raw_payload = Column(JSON, default=dict, nullable=False)
    error = Column(Text, nullable=True)


class QuotaUsage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "quota_usage"
    __table_args__ = (UniqueConstraint("user_id", "feature_code", "period_key", name="uq_quota_usage_period"),)

    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    feature_code = Column(String(100), nullable=False, index=True)
    period_key = Column(String(30), nullable=False, index=True)
    used_value = Column(Integer, default=0, nullable=False)
    metadata_json = Column(JSON, default=dict, nullable=False)

"""Subscription entitlement service used by all business modules."""

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import PlanEntitlement, QuotaUsage, SubscriptionPlan, TenantSubscription
from app.models.user import User
from app.services.evidence_service import configuration_required

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def _load_default_plans() -> list[dict]:
    path = DATA_DIR / "default_subscription_plans.json"
    return json.loads(path.read_text(encoding="utf-8"))


async def seed_subscription_plans(db: AsyncSession) -> None:
    """Seed commercial plans and their entitlements from data files."""
    for item in _load_default_plans():
        plan = await db.get(SubscriptionPlan, item["code"])
        plan_data = {k: v for k, v in item.items() if k != "entitlements"}
        if plan:
            for key, value in plan_data.items():
                setattr(plan, key, value)
            plan.is_active = True
        else:
            db.add(SubscriptionPlan(**plan_data, is_active=True, metadata_json={}))

        for entitlement in item["entitlements"]:
            result = await db.execute(
                select(PlanEntitlement).where(
                    PlanEntitlement.plan_code == item["code"],
                    PlanEntitlement.feature_code == entitlement["feature_code"],
                )
            )
            row = result.scalar_one_or_none()
            if row:
                row.feature_name = entitlement["feature_name"]
                row.enabled = entitlement["enabled"]
                row.limit_value = entitlement["limit_value"]
                row.unit = entitlement["unit"]
                continue
            db.add(PlanEntitlement(plan_code=item["code"], metadata_json={}, **entitlement))
    await db.commit()


async def list_plans(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.is_active == True).order_by(SubscriptionPlan.sort_order)
    )
    plans = result.scalars().all()
    ent_result = await db.execute(select(PlanEntitlement))
    entitlements: dict[str, list[dict]] = {}
    for item in ent_result.scalars().all():
        entitlements.setdefault(item.plan_code, []).append(_serialize_entitlement(item))
    return [
        {
            "code": item.code,
            "name": item.name,
            "description": item.description,
            "price_cents": item.price_cents,
            "currency": item.currency,
            "billing_cycle": item.billing_cycle,
            "entitlements": entitlements.get(item.code, []),
        }
        for item in plans
    ]


async def get_active_subscription(db: AsyncSession, user: User) -> dict:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(TenantSubscription)
        .where(
            TenantSubscription.user_id == user.id,
            TenantSubscription.status == "active",
        )
        .order_by(TenantSubscription.started_at.desc())
    )
    subscription = result.scalar_one_or_none()
    if subscription and (subscription.expires_at is None or subscription.expires_at > now):
        return {
            "status": "active",
            "plan_code": subscription.plan_code,
            "started_at": subscription.started_at.isoformat(),
            "expires_at": subscription.expires_at.isoformat() if subscription.expires_at else None,
            "source": subscription.source,
        }
    free_plan = await db.get(SubscriptionPlan, "free")
    if not free_plan:
        return {
            "plan_code": None,
            **configuration_required(
                "缺少免费套餐配置，无法确定当前用户权益",
                data_gaps=["subscription_plans.free"],
                evidence_window="当前套餐配置表",
            ),
        }
    return {"status": "default_free", "plan_code": "free", "started_at": None, "expires_at": None, "source": "default"}


async def get_current_entitlements(db: AsyncSession, user: User) -> dict:
    subscription = await get_active_subscription(db, user)
    plan_code = subscription.get("plan_code")
    if not plan_code:
        return {"subscription": subscription, "features": {}, "data_gaps": ["subscription_plans"]}
    result = await db.execute(select(PlanEntitlement).where(PlanEntitlement.plan_code == plan_code))
    features = {item.feature_code: _serialize_entitlement(item) for item in result.scalars().all()}
    return {"subscription": subscription, "features": features, "data_gaps": []}


async def check_entitlement(db: AsyncSession, user: User, feature_code: str, requested: int = 1) -> dict:
    payload = await get_current_entitlements(db, user)
    feature = payload["features"].get(feature_code)
    if not feature:
        return {"allowed": False, "reason": "entitlement_missing", "feature_code": feature_code}
    if not feature["enabled"]:
        return {"allowed": False, "reason": "feature_disabled", "feature_code": feature_code}
    limit_value = feature.get("limit_value")
    period_key = _period_key(feature_code)
    used_value = await _get_used_value(db, user.id, feature_code, period_key) if period_key else 0
    if limit_value is not None and used_value + requested > limit_value:
        return {
            "allowed": False,
            "reason": "limit_exceeded",
            "feature_code": feature_code,
            "limit_value": limit_value,
            "used_value": used_value,
            "requested": requested,
            "period_key": period_key,
        }
    return {
        "allowed": True,
        "reason": "ok",
        "feature_code": feature_code,
        "limit_value": limit_value,
        "used_value": used_value,
        "requested": requested,
        "period_key": period_key,
    }


async def require_entitlement(db: AsyncSession, user: User, feature_code: str, requested: int = 1) -> None:
    result = await check_entitlement(db, user, feature_code, requested)
    if not result["allowed"]:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=result)


async def consume_quota(db: AsyncSession, user: User, feature_code: str, amount: int = 1) -> dict:
    period_key = _period_key(feature_code) or "lifetime"
    result = await db.execute(
        select(QuotaUsage).where(
            QuotaUsage.user_id == user.id,
            QuotaUsage.feature_code == feature_code,
            QuotaUsage.period_key == period_key,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.used_value += amount
    else:
        row = QuotaUsage(
            user_id=user.id,
            feature_code=feature_code,
            period_key=period_key,
            used_value=amount,
            metadata_json={},
        )
        db.add(row)
    await db.commit()
    return {"feature_code": feature_code, "period_key": period_key, "used_value": row.used_value}


async def require_and_consume_quota(db: AsyncSession, user: User, feature_code: str, amount: int = 1) -> dict:
    await require_entitlement(db, user, feature_code, amount)
    return await consume_quota(db, user, feature_code, amount)


async def quota_usage_summary(db: AsyncSession, user: User) -> list[dict]:
    result = await db.execute(select(QuotaUsage).where(QuotaUsage.user_id == user.id))
    return [
        {
            "feature_code": item.feature_code,
            "period_key": item.period_key,
            "used_value": item.used_value,
        }
        for item in result.scalars().all()
    ]


async def _get_used_value(db: AsyncSession, user_id: str, feature_code: str, period_key: str | None) -> int:
    if not period_key:
        return 0
    result = await db.execute(
        select(QuotaUsage.used_value).where(
            QuotaUsage.user_id == user_id,
            QuotaUsage.feature_code == feature_code,
            QuotaUsage.period_key == period_key,
        )
    )
    return result.scalar_one_or_none() or 0


def _period_key(feature_code: str) -> str | None:
    if feature_code.endswith(".monthly"):
        return datetime.now(timezone.utc).strftime("%Y-%m")
    return None


def _serialize_entitlement(item: PlanEntitlement) -> dict:
    return {
        "feature_code": item.feature_code,
        "feature_name": item.feature_name,
        "enabled": bool(item.enabled),
        "limit_value": item.limit_value,
        "unit": item.unit,
    }

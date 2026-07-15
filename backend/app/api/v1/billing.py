"""Billing and entitlement API."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.billing import PaymentOrder, SubscriptionPlan
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.audit_service import record_audit_event
from app.services import entitlement_service
from app.services.config_service import get_config_value
from app.services.evidence_service import configuration_required, source_ref

router = APIRouter(prefix="/billing", tags=["billing"], dependencies=[Depends(get_current_user)])


class PaymentOrderCreate(BaseModel):
    plan_code: str
    channel: str


@router.get("/plans", response_model=ApiResponse)
async def get_plans(db: AsyncSession = Depends(get_db)):
    plans = await entitlement_service.list_plans(db)
    return ApiResponse(
        data=plans,
        status="ready" if plans else "configuration_required",
        source_refs=[source_ref("subscription_plan", item["code"], label=item["name"]) for item in plans],
        evidence_window="当前启用套餐配置",
        confidence_reason="套餐与权益直接读取当前启用的订阅计划。",
        data_gaps=[] if plans else ["暂无启用套餐"],
    )


@router.get("/subscription", response_model=ApiResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subscription = await entitlement_service.get_active_subscription(db, current_user)
    gaps = subscription.get("data_gaps", [])
    plan_code = subscription.get("plan_code")
    return ApiResponse(
        data=subscription,
        status=subscription.get("status", "configuration_required"),
        source_refs=[source_ref("subscription_plan", plan_code, label=plan_code)] if plan_code else [],
        evidence_window="当前用户有效订阅",
        confidence_reason=subscription.get("confidence_reason", "订阅状态直接读取当前有效订阅；无付费订阅时明确使用免费套餐。"),
        data_gaps=gaps,
    )


@router.get("/entitlements", response_model=ApiResponse)
async def get_entitlements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entitlements = await entitlement_service.get_current_entitlements(db, current_user)
    gaps = entitlements.get("data_gaps", [])
    return ApiResponse(
        data=entitlements,
        status="ready" if not gaps else "configuration_required",
        source_refs=[source_ref("plan_entitlement", code, label=item.get("feature_name"))
                     for code, item in entitlements.get("features", {}).items()],
        evidence_window="当前订阅权益快照",
        confidence_reason="权益开关与额度来自当前有效套餐。",
        data_gaps=gaps,
    )


@router.get("/quota-usage", response_model=ApiResponse)
async def get_quota_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    usage = await entitlement_service.quota_usage_summary(db, current_user)
    return ApiResponse(
        data=usage,
        status="ready" if usage else "data_required",
        source_refs=[source_ref("quota_usage", f"{item['feature_code']}:{item['period_key']}", label=item["feature_code"]) for item in usage],
        evidence_window="当前计费区间额度用量",
        confidence_reason="仅展示已实际计量的额度使用记录。",
        data_gaps=[] if usage else ["当前计费区间暂无额度消耗记录"],
    )


@router.post("/orders", response_model=ApiResponse)
async def create_payment_order(
    payload: PaymentOrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.channel not in {"wechat", "alipay"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "unsupported_payment_channel", "channel": payload.channel},
        )
    plan = await db.get(SubscriptionPlan, payload.plan_code)
    if not plan or not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "plan_not_found", "plan_code": payload.plan_code},
        )
    if plan.price_cents <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "payment_not_required", "plan_code": payload.plan_code},
        )
    merchant_key = await get_config_value(db, f"payment.{payload.channel}.merchant_id")
    if not merchant_key:
        await record_audit_event(
            db,
            user=current_user,
            action="payment_configuration_missing",
            resource_type="payment_order",
            resource_id=f"{payload.channel}:{plan.code}",
            new_value={"channel": payload.channel, "plan_code": plan.code},
            detail="支付商户信息未配置，订单未提交到第三方支付。",
        )
        missing = configuration_required(
            "支付商户信息未配置，订单未提交到第三方支付。",
            data_gaps=[f"payment.{payload.channel}.merchant_id"],
            evidence_window="当前支付配置",
        )
        return ApiResponse(
            data={
                "channel": payload.channel,
                "required_config": [f"payment.{payload.channel}.merchant_id"],
                **missing,
            },
            status=missing["status"], source_refs=missing["source_refs"], evidence_window=missing["evidence_window"],
            confidence_reason=missing["confidence_reason"], data_gaps=missing["data_gaps"],
        )
    existing_result = await db.execute(
        select(PaymentOrder)
        .where(
            PaymentOrder.user_id == current_user.id,
            PaymentOrder.plan_code == plan.code,
            PaymentOrder.channel == payload.channel,
            PaymentOrder.status == "integration_required",
        )
        .order_by(PaymentOrder.created_at.desc())
        .limit(1)
    )
    existing_order = existing_result.scalar_one_or_none()
    if existing_order:
        payload_data = _integration_required_payload(existing_order)
        return _payment_response(payload_data)
    order = PaymentOrder(
        user_id=current_user.id,
        plan_code=plan.code,
        channel=payload.channel,
        amount_cents=plan.price_cents,
        currency=plan.currency,
        subject=f"CBHunter {plan.name}",
        status="integration_required",
        metadata_json={"source": "billing_api", "gateway_submitted": False},
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    await record_audit_event(
        db,
        user=current_user,
        action="payment_order_create",
        resource_type="payment_order",
        resource_id=order.id,
        new_value={
            "plan_code": order.plan_code,
            "channel": order.channel,
            "amount_cents": order.amount_cents,
            "currency": order.currency,
            "status": order.status,
        },
        detail="创建套餐支付订单。",
    )
    return _payment_response(_integration_required_payload(order))


def _payment_response(payload: dict) -> ApiResponse:
    return ApiResponse(
        data=payload,
        status=payload["status"],
        source_refs=payload["source_refs"],
        evidence_window=payload["evidence_window"],
        confidence_reason=payload["confidence_reason"],
        data_gaps=payload["data_gaps"],
    )


def _integration_required_payload(order: PaymentOrder) -> dict:
    return {
        "id": order.id,
        "order_status": order.status,
        "channel": order.channel,
        "amount_cents": order.amount_cents,
        "currency": order.currency,
        "gateway_submitted": False,
        **configuration_required(
            "支付意向已记录，但真实支付网关、验签回调和证书尚未接入，未向支付渠道下单。",
            data_gaps=[
                f"payment.{order.channel}.gateway_adapter",
                f"payment.{order.channel}.callback_signature",
                f"payment.{order.channel}.certificate",
            ],
            evidence_window="当前支付网关实现状态",
        ),
    }

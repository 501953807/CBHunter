"""Settings API for platform fee and pricing adjustment templates."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.fee_template import FeeTemplate
from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/settings", tags=["settings"])
PRICING_ADJUSTMENT_TEMPLATE_KEY = "pricing.adjustment_templates"
logger = logging.getLogger(__name__)


class FeeRateItem(BaseModel):
    id: str
    commission: float
    transaction: float
    tech: float
    low_value_tax: float


class PricingAdjustmentTemplateItem(BaseModel):
    id: str
    label: str
    platform: str
    market: str
    shipping_cost_rmb: float = 0
    activity_discount_pct: float = 0
    min_profit_rmb: float = 0
    target_profit_pct: float = 20


@router.get("/fee-rates", response_model=ApiResponse)
async def get_fee_rates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回费率表（读取 fee_templates，不注入默认费率）."""
    result = await db.execute(select(FeeTemplate).where(FeeTemplate.is_active == True))
    platform_labels = {
        item["id"]: item["label"]
        for item in await config_service.get_platforms(db)
    }
    grouped: dict[str, list[dict]] = {}
    flat: list[dict] = []
    for fee in result.scalars().all():
        raw_rates = [fee.commission_pct, fee.transaction_fee_pct, fee.tech_service_pct, fee.vat_pct]
        item = {
            "id": f"{fee.platform}_{fee.market}",
            "platform": platform_labels.get(fee.platform, fee.platform),
            "market": fee.market,
            "commission": fee.commission_pct / 100 if fee.commission_pct is not None else None,
            "transaction": fee.transaction_fee_pct / 100 if fee.transaction_fee_pct is not None else None,
            "tech": fee.tech_service_pct / 100 if fee.tech_service_pct is not None else None,
            "low_value_tax": fee.vat_pct / 100 if fee.vat_pct is not None else None,
        }
        total = sum(value for value in raw_rates if value is not None) / 100 if all(value is not None for value in raw_rates) else None
        item["total"] = round(total, 4) if total is not None else None
        item["total_pct"] = f"{total*100:.1f}%" if total is not None else None
        grouped.setdefault(item["platform"], []).append(item)
        flat.append(item)
    gaps = [] if flat else ["暂无启用平台费率模板"]
    if any(item["total"] is None for item in flat):
        gaps.append("部分平台费率模板字段不完整")
    adjustment_templates = await _get_pricing_adjustment_templates(db)
    return ApiResponse(
        data={"grouped": grouped, "flat": flat, "pricing_adjustment_templates": adjustment_templates},
        status="ready" if flat and not gaps else "configuration_required",
        source_refs=[source_ref("fee_template", item["id"], label=f"{item['platform']}/{item['market']}") for item in flat],
        evidence_window="当前启用平台费率模板",
        confidence_reason="费率直接读取数据库配置；未知费率保持为空，不按 0% 处理。",
        data_gaps=gaps,
    )


@router.put("/fee-rates", response_model=ApiResponse)
async def update_fee_rate(
    req: FeeRateItem,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新某条费率（保存到 fee_templates 表）."""
    for k in ("commission", "transaction", "tech", "low_value_tax"):
        v = getattr(req, k)
        if v < 0 or v > 1:
            raise HTTPException(status_code=400, detail=f"{k} 值必须介于 0-1 之间（当前: {v}）")

    platform, market = req.id.split("_", 1) if "_" in req.id else ("", "")
    if not platform or not market:
        raise HTTPException(status_code=400, detail="费率ID必须为 platform_market 格式")
    result = await db.execute(
        select(FeeTemplate).where(FeeTemplate.platform == platform, FeeTemplate.market == market)
    )
    fee = result.scalar_one_or_none()
    old_value = _fee_snapshot(fee)
    if not fee:
        fee = FeeTemplate(platform=platform, market=market, is_active=True)
        db.add(fee)
    fee.commission_pct = req.commission * 100
    fee.transaction_fee_pct = req.transaction * 100
    fee.tech_service_pct = req.tech * 100
    fee.vat_pct = req.low_value_tax * 100
    fee.notes = "settings"
    await db.commit()
    await record_audit_event(
        db,
        user=admin,
        action="fee_rate_update",
        resource_type="fee_template",
        resource_id=req.id,
        old_value=old_value,
        new_value=_fee_snapshot(fee),
        detail="设置中心更新平台费率",
    )
    return ApiResponse(data={"message": "费率已更新"})


@router.get("/pricing-adjustment-templates", response_model=ApiResponse)
async def get_pricing_adjustment_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回可复用的物流、活动折扣和利润底线模板."""
    templates = await _get_pricing_adjustment_templates(db)
    return ApiResponse(
        data={"templates": templates},
        status="ready",
        source_refs=[source_ref("system_config", PRICING_ADJUSTMENT_TEMPLATE_KEY, label="定价附加模板")],
        evidence_window="当前系统配置",
        confidence_reason="定价附加模板读取 system_config JSON；未配置时返回空列表，不注入默认模板。",
    )


@router.put("/pricing-adjustment-templates", response_model=ApiResponse)
async def update_pricing_adjustment_templates(
    req: list[PricingAdjustmentTemplateItem],
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """保存可复用定价附加模板到 system_config."""
    templates = [_normalize_pricing_adjustment_template(item) for item in req]
    old_value = await _get_system_config_value(db, PRICING_ADJUSTMENT_TEMPLATE_KEY)
    row = await db.scalar(select(SystemConfig).where(SystemConfig.key == PRICING_ADJUSTMENT_TEMPLATE_KEY))
    payload = json.dumps({"templates": templates}, ensure_ascii=False)
    if row:
        row.value = payload
        row.label = "定价附加模板"
    else:
        row = SystemConfig(key=PRICING_ADJUSTMENT_TEMPLATE_KEY, value=payload, label="定价附加模板")
        db.add(row)
    await db.commit()
    await record_audit_event(
        db,
        user=admin,
        action="pricing_adjustment_template_update",
        resource_type="system_config",
        resource_id=PRICING_ADJUSTMENT_TEMPLATE_KEY,
        old_value={"value": old_value},
        new_value={"templates": templates},
        detail="设置中心更新定价附加模板",
    )
    return ApiResponse(data={"templates": templates, "message": "定价附加模板已更新"})


def _fee_snapshot(fee: Optional[FeeTemplate]) -> Optional[dict]:
    if not fee:
        return None
    return {
        "platform": fee.platform,
        "market": fee.market,
        "commission_pct": fee.commission_pct,
        "transaction_fee_pct": fee.transaction_fee_pct,
        "tech_service_pct": fee.tech_service_pct,
        "vat_pct": fee.vat_pct,
        "is_active": fee.is_active,
    }


async def _get_pricing_adjustment_templates(db: AsyncSession) -> list[dict]:
    raw = await _get_system_config_value(db, PRICING_ADJUSTMENT_TEMPLATE_KEY)
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("Invalid pricing adjustment template JSON: %s", exc)
        return []
    templates = payload.get("templates") if isinstance(payload, dict) else None
    if not isinstance(templates, list):
        return []
    normalized = []
    for item in templates:
        if not isinstance(item, dict):
            continue
        try:
            normalized.append(_normalize_pricing_adjustment_template(PricingAdjustmentTemplateItem(**item)))
        except ValueError as exc:
            logger.warning("Invalid pricing adjustment template item skipped: %s", exc)
            continue
    return normalized


async def _get_system_config_value(db: AsyncSession, key: str) -> Optional[str]:
    row = await db.scalar(select(SystemConfig).where(SystemConfig.key == key))
    return row.value if row else None


def _normalize_pricing_adjustment_template(item: PricingAdjustmentTemplateItem) -> dict:
    values = {
        "shipping_cost_rmb": item.shipping_cost_rmb,
        "activity_discount_pct": item.activity_discount_pct,
        "min_profit_rmb": item.min_profit_rmb,
        "target_profit_pct": item.target_profit_pct,
    }
    if any(value < 0 for value in values.values()):
        raise HTTPException(status_code=400, detail="定价模板金额、折扣和利润率不能为负数")
    if item.activity_discount_pct > 95:
        raise HTTPException(status_code=400, detail="活动折扣必须介于 0-95 之间")
    if item.target_profit_pct > 100:
        raise HTTPException(status_code=400, detail="目标利润率必须介于 0-100 之间")
    if not item.id.strip() or not item.label.strip() or not item.platform.strip() or not item.market.strip():
        raise HTTPException(status_code=400, detail="定价模板必须包含 id、label、platform 和 market")
    return {
        "id": item.id.strip(),
        "label": item.label.strip(),
        "platform": item.platform.strip(),
        "market": item.market.strip(),
        "shipping_cost_rmb": round(item.shipping_cost_rmb, 2),
        "activity_discount_pct": round(item.activity_discount_pct, 2),
        "min_profit_rmb": round(item.min_profit_rmb, 2),
        "target_profit_pct": round(item.target_profit_pct, 2),
    }

"""Settings API for platform fee templates."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.fee_template import FeeTemplate
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/settings", tags=["settings"])


class FeeRateItem(BaseModel):
    id: str
    commission: float
    transaction: float
    tech: float
    low_value_tax: float


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
    return ApiResponse(
        data={"grouped": grouped, "flat": flat},
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

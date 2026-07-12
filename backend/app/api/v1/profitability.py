"""API endpoints for profitability analysis."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.api.v1.response_helpers import evidence_response
from app.schemas.profitability import (
    ProfitabilityRequest,
)
from app.models.exchange_rate import ExchangeRate
from app.models.fee_template import FeeTemplate
from app.services import config_service
from app.services.evidence_service import configuration_required, data_required, evidence_payload, source_ref

router = APIRouter(prefix="/profitability", tags=["profitability"])


@router.get("/platforms", response_model=ApiResponse)
async def list_platforms(current_user: User = Depends(get_current_user)):
    """Legacy endpoint retained for compatibility; use /platforms/list."""
    return ApiResponse(data={})


@router.get("/platforms/list", response_model=ApiResponse)
async def list_all_platforms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a flat list of all platform+market combinations."""
    result = await db.execute(select(FeeTemplate).where(FeeTemplate.is_active == True))
    market_currency = {
        market["id"].upper(): market.get("currency") or ""
        for market in await config_service.get_markets(db)
    }
    items = []
    for fee in result.scalars().all():
        if any(value is None for value in (
            fee.commission_pct, fee.transaction_fee_pct, fee.tech_service_pct
        )):
            continue
        items.append({
            "platform": fee.platform,
            "market": fee.market,
            "label": f"{fee.platform} - {fee.market}",
            "currency": market_currency.get((fee.market or "").upper(), ""),
            "commission_rate": fee.commission_pct / 100,
        })
    return ApiResponse(data=items)


@router.post("/calculate", response_model=ApiResponse)
async def calculate_profitability(
    req: ProfitabilityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate full profitability analysis using configured fees/rates only."""
    if req.shipping_cost_rmb is None or req.shipping_cost_rmb <= 0:
        return evidence_response({
            "note": "请填写实际运费。系统不再自动估算物流成本。",
            **data_required(
                "请填写实际运费。系统不再自动估算物流成本。",
                data_gaps=["shipping_cost_rmb"],
                evidence_window="当前请求输入",
            ),
        })

    fee_result = await db.execute(
        select(FeeTemplate).where(
            FeeTemplate.platform == req.platform,
            FeeTemplate.market == req.market,
            FeeTemplate.is_active == True,
        )
    )
    fee = fee_result.scalar_one_or_none()
    if not fee:
        return evidence_response({
            "note": "未配置该平台/市场费率，无法计算真实利润。",
            **configuration_required(
                "未配置该平台/市场费率，无法计算真实利润。",
                data_gaps=["fee_templates"],
                evidence_window="当前费率模板配置",
            ),
        })
    required_fee_values = (fee.commission_pct, fee.transaction_fee_pct, fee.tech_service_pct)
    if any(value is None for value in required_fee_values):
        return evidence_response({
            "note": "该平台/市场费率配置不完整，无法计算真实利润。",
            **configuration_required(
                "该平台/市场费率配置不完整，无法计算真实利润。",
                data_gaps=["fee_templates.commission_pct", "fee_templates.transaction_fee_pct", "fee_templates.tech_service_pct"],
                evidence_window="当前费率模板配置",
            ),
        })

    rate = await _latest_rate_for_market(db, req.market)
    if not rate:
        return evidence_response({
            "note": "未找到该市场对应的最新汇率，无法换算本币售价。",
            **configuration_required(
                "未找到该市场对应的最新汇率，无法换算本币售价。",
                data_gaps=["exchange_rates", "markets.currency"],
                evidence_window="当前市场字典与汇率配置",
            ),
        })

    commission_rate = fee.commission_pct / 100
    transaction_fee_rate = fee.transaction_fee_pct / 100
    tech_fee_rate = fee.tech_service_pct / 100
    total_fee_rate = commission_rate + transaction_fee_rate + tech_fee_rate
    base_cost = req.purchase_cost_rmb + req.shipping_cost_rmb

    markup = 1 + req.markup_pct / 100
    selling_price_rmb = base_cost * markup
    platform_fee_rmb = selling_price_rmb * total_fee_rate
    net_profit_rmb = selling_price_rmb - base_cost - platform_fee_rmb
    margin = (net_profit_rmb / selling_price_rmb * 100) if selling_price_rmb else 0
    selling_price_local = selling_price_rmb * rate.rate
    scenarios = [{
        "selling_price_local": round(selling_price_local, 2),
        "selling_price_rmb": round(selling_price_rmb, 2),
        "platform_fee_rmb": round(platform_fee_rmb, 2),
        "net_profit_rmb": round(net_profit_rmb, 2),
        "profit_margin_pct": round(margin, 1),
    }]

    breakeven_rmb = base_cost / (1 - total_fee_rate) if total_fee_rate < 1 else None
    return evidence_response({
        "status": "ready",
        "purchase_cost_rmb": req.purchase_cost_rmb,
        "weight_g": req.weight_g,
        "target_platform": req.platform,
        "target_market": req.market,
        "platform_display": req.platform,
        "market_display": req.market,
        "currency": rate.to_currency,
        "exchange_rate": rate.rate,
        "shipping_cost_rmb": req.shipping_cost_rmb,
        "commission_rate": commission_rate,
        "transaction_fee_rate": transaction_fee_rate,
        "scenarios": scenarios,
        "recommended_price": None,
        "recommended_markup": None,
        "input_markup_pct": req.markup_pct,
        "breakeven_price_local": round(breakeven_rmb * rate.rate, 2) if breakeven_rmb else None,
        "breakeven_price_rmb": round(breakeven_rmb, 2) if breakeven_rmb else None,
        **evidence_payload(
            source_refs=[
                source_ref(
                    "fee_template",
                    fee.id,
                    fields=["commission_pct", "transaction_fee_pct", "tech_service_pct"],
                    label=f"{req.platform}/{req.market} 费率模板",
                    meta={"platform": req.platform, "market": req.market},
                ),
                source_ref(
                    "exchange_rate",
                    rate.id,
                    fields=["from_currency", "to_currency", "rate", "fetched_at"],
                    label=f"CNY/{rate.to_currency} 汇率",
                    meta={"source": rate.source, "fetched_at": rate.fetched_at},
                ),
            ],
            evidence_window="当前请求输入 + 当前平台费率模板 + 最新汇率记录",
            confidence_reason="利润测算使用用户录入采购价、实际运费、已配置费率和最新汇率记录，未使用估算运费、固定费率或固定汇率。",
            data_gaps=[],
        ),
    })


@router.get("/quick", response_model=ApiResponse)
async def quick_profitability(
    purchase_cost: float = Query(gt=0, alias="cost"),
    weight: int = Query(gt=0),
    platform: str = Query(...),
    market: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Quick profitability check is disabled until configured fee/rate inputs exist."""
    return evidence_response({
        "note": "快速利润检查已停用，请使用完整利润计算并录入真实运费、费率和汇率。",
        **data_required(
            "快速利润检查已停用，请使用完整利润计算并录入真实运费、费率和汇率。",
            data_gaps=["shipping_cost_rmb", "fee_templates", "exchange_rates"],
            evidence_window="当前请求输入与配置快照",
        ),
    })

async def _latest_rate_for_market(db: AsyncSession, market: str) -> Optional[ExchangeRate]:
    market_upper = market.upper()
    market_currency = {
        item["id"].upper(): item.get("currency")
        for item in await config_service.get_markets(db)
        if item.get("currency")
    }
    currency = market_currency.get(market_upper)
    if not currency:
        return None
    result = await db.execute(
        select(ExchangeRate)
        .where(ExchangeRate.from_currency == "CNY", ExchangeRate.to_currency == currency)
        .order_by(ExchangeRate.fetched_at.desc())
    )
    return result.scalars().first()

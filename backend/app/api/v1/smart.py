"""Smart Engine API — keyword radar, cross-validation, fee templates."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.fee_template import FeeTemplate
from app.models.user import User
from app.schemas.common import ApiResponse
from app.api.v1.response_helpers import evidence_response
from app.services.smart_radar_service import (
    search_shopee_keywords,
    cross_validate_1688,
    get_fee_templates,
    save_fee_template,
    get_latest_exchange_rates,
)
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.evidence_service import (
    configuration_required,
    data_required,
    evidence_payload,
    source_ref,
    unique_refs,
)

router = APIRouter(prefix="/smart", tags=["smart-engine"], dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════
# Keyword Radar
# ══════════════════════════════════════════

@router.post("/radar/search")
async def radar_search(
    keywords: list[str],
    market: str = Query(..., description="Target market code"),
    db: AsyncSession = Depends(get_db),
):
    """Search Shopee for keyword competition data."""
    if not keywords:
        raise HTTPException(status_code=400, detail="请提供至少一个关键词")
    if len(keywords) > 20:
        raise HTTPException(status_code=400, detail="单次最多分析 20 个关键词")

    results = await search_shopee_keywords(db, keywords, market)
    usable = [item for item in results if not item.get("error")]
    gaps = [f"{item.get('keyword', '关键词')}：{item.get('error')}" for item in results if item.get("error")]
    return ApiResponse(data={
        "market": market,
        "total_analyzed": len(results),
        "results": results,
    }, status="ready" if usable and not gaps else "data_required",
        source_refs=[source_ref("shopee_search", item.get("keyword"), meta={"market": market}) for item in usable],
        evidence_window="本次 Shopee 公开搜索采集窗口",
        confidence_reason="竞争信号仅基于本次可获取的 Shopee 搜索结果，不代表平台官方销量。",
        data_gaps=gaps or ([] if usable else ["未获取到可用 Shopee 搜索结果"]),
    )


# ══════════════════════════════════════════
# 1688 × Shopee Cross-Validation
# ══════════════════════════════════════════

@router.post("/cross-validate")
async def cross_validate(
    market: str = Query(...),
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Cross-validate 1688 hot keywords against Shopee competition."""
    results = await cross_validate_1688(db, market=market, limit=limit)
    complete = [item for item in results if item.get("cross_validation_score") is not None]
    return ApiResponse(data={
        "market": market,
        "source": "1688_suggestions",
        "total_found": len(results),
        "results": results,
    }, status="ready" if complete else "data_required",
        source_refs=unique_refs([
            *[source_ref("1688_suggestion", item.get("keyword_1688"), meta={"category": item.get("source_category")}) for item in results],
            *[source_ref("shopee_search", item.get("keyword_1688"), meta={"market": market}) for item in complete],
        ]),
        evidence_window="本次 1688 建议词与 Shopee 搜索交叉采集窗口",
        confidence_reason="交叉得分只组合可观测热度与竞争信号，仍需成本、利润和供应商资料。",
        data_gaps=[] if complete else ["缺少可同时验证的 1688 热度与 Shopee 竞争数据"],
    )


# ══════════════════════════════════════════
# Cross-platform Trend Validation (Google × Pinterest)
# ══════════════════════════════════════════

@router.post("/cross-trends")
async def cross_trends(data: dict):
    """Cross-reference Google Trends keywords with Pinterest signals.

    Request body:
      { category: str, google_keywords: [{keyword}], pinterest_keywords: [{keyword}] }
    """
    google_kws = data.get("google_keywords", [])
    pinterest_kws = data.get("pinterest_keywords", [])
    category = data.get("category", "")

    pinterest_set = {p["keyword"].lower().strip() for p in pinterest_kws if p.get("keyword")}
    overlap = []
    for g in google_kws:
        kw = g.get("keyword", "").lower().strip()
        if kw and kw in pinterest_set:
            overlap.append({
                "keyword": g["keyword"],
                "pinterest_present": True,
                "score": None,
            })

    overlap.sort(key=lambda x: x["keyword"].lower())
    pct = round((len(overlap) / max(len(google_kws), 1)) * 100)

    suggestion = (
        f"双源精确重合度为 {pct}%，该结果只反映关键词交集，仍需结合竞品、成本和利润验证。"
    )

    refs = [source_ref("google_trend_keyword", item.get("keyword")) for item in google_kws if item.get("keyword")]
    refs.extend(source_ref("pinterest_keyword", item.get("keyword")) for item in pinterest_kws if item.get("keyword"))
    gaps = [] if google_kws and pinterest_kws else ["Google 或 Pinterest 关键词样本为空"]
    return ApiResponse(data={
        "category": category,
        "overlap_count": len(overlap),
        "overlap_pct": pct,
        "overlap_keywords": overlap,
        "suggestion": suggestion,
    }, status="ready" if not gaps else "data_required", source_refs=unique_refs(refs),
        evidence_window="本次提交的 Google 与 Pinterest 关键词集合",
        confidence_reason="结果只表示两个来源的精确关键词交集，不推断销量或利润。",
        data_gaps=gaps,
    )


# ══════════════════════════════════════════
# Fee Templates
# ══════════════════════════════════════════

@router.get("/fees")
async def list_fees(
    platform: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List fee templates from database."""
    templates = await get_fee_templates(db, platform=platform)
    return ApiResponse(data=templates)


@router.post("/fees")
async def create_or_update_fee(
    template: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create or update a fee template."""
    required = ["platform", "market"]
    for field in required:
        if field not in template:
            await record_audit_event(
                db,
                user=admin,
                action="fee_template_save_blocked",
                resource_type="fee_template",
                resource_id=f"{template.get('platform', 'unknown')}:{template.get('market', 'unknown')}",
                new_value={"template": template, "missing_field": field},
                detail="智能引擎费率模板保存失败：缺少必填字段",
            )
            raise HTTPException(status_code=400, detail=f"缺少必填字段: {field}")

    existing_result = await db.execute(
        select(FeeTemplate).where(
            FeeTemplate.platform == template["platform"],
            FeeTemplate.market == template["market"],
        )
    )
    old_value = _fee_template_snapshot(existing_result.scalar_one_or_none())
    try:
        result = await save_fee_template(db, template)
    except ValueError as exc:
        await record_audit_event(
            db,
            user=admin,
            action="fee_template_save_blocked",
            resource_type="fee_template",
            resource_id=f"{template.get('platform', 'unknown')}:{template.get('market', 'unknown')}",
            old_value=old_value,
            new_value={"template": template, "error": str(exc)},
            detail="智能引擎费率模板保存失败：配置不完整",
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=admin,
        action="fee_template_save",
        resource_type="fee_template",
        resource_id=result.id,
        old_value=old_value,
        new_value=_fee_template_snapshot(result),
        detail="智能引擎保存平台/市场费率模板",
    )
    return ApiResponse(data={
        "id": result.id,
        "platform": result.platform,
        "market": result.market,
        "message": "费率模板已保存",
    })


# ══════════════════════════════════════════
# Exchange Rates
# ══════════════════════════════════════════

@router.get("/exchange-rates")
async def list_exchange_rates(db: AsyncSession = Depends(get_db)):
    """Get latest exchange rates."""
    rates = await get_latest_exchange_rates(db)
    return ApiResponse(data=rates)


@router.post("/exchange-rates/refresh")
async def refresh_exchange_rates(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Fetch latest exchange rates from external API (exchangerate-api.com)."""
    import httpx
    from app.models.exchange_rate import ExchangeRate as ER
    import uuid

    markets = await config_service.get_markets(db)
    currencies = sorted({
        market.get("currency")
        for market in markets
        if market.get("currency") and market.get("currency") != "CNY"
    })
    if not currencies:
        await record_audit_event(
            db,
            user=admin,
            action="exchange_rate_refresh_blocked",
            resource_type="exchange_rate",
            resource_id="CNY",
            new_value={"markets": markets, "data_gaps": ["markets.currency"]},
            detail="汇率刷新失败：市场字典未配置 currency 字段",
        )
        return evidence_response({
            "saved": 0,
            "rates": [],
            **configuration_required(
                "请先在市场字典中配置 currency 字段",
                data_gaps=["markets.currency"],
                evidence_window="当前市场字典配置",
            ),
        })
    saved = []
    failed = []

    for currency in currencies:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"https://api.exchangerate-api.com/v4/latest/CNY"
                )
            if resp.status_code == 200:
                data = resp.json()
                rate = data.get("rates", {}).get(currency)
                if rate:
                    er = ER(
                        id=str(uuid.uuid4()),
                        from_currency="CNY",
                        to_currency=currency,
                        rate=rate,
                        source="exchangerate-api",
                    )
                    db.add(er)
                    saved.append({"currency": currency, "rate": rate})
                else:
                    failed.append(currency)
            else:
                failed.append(currency)
        except Exception as e:
            logger.warning(f"Failed to fetch {currency} rate: {e}")
            failed.append(currency)

    await db.commit()
    await record_audit_event(
        db,
        user=admin,
        action="exchange_rate_refresh",
        resource_type="exchange_rate",
        resource_id="CNY",
        new_value={
            "requested_currencies": currencies,
            "saved": saved,
            "failed": sorted(set(failed)),
            "source": "exchangerate-api",
        },
        detail="刷新目标市场汇率",
    )
    if not saved:
        return evidence_response({
            "saved": 0,
            "rates": [],
            **data_required(
                "未能获取任何目标市场汇率，请检查外部汇率服务或网络状态。",
                data_gaps=[f"exchange_rates.{currency}" for currency in currencies],
                evidence_window="本次汇率刷新请求",
            ),
        })
    return evidence_response({
        "status": "ready",
        "saved": len(saved),
        "rates": saved,
        **evidence_payload(
            source_refs=[
                source_ref(
                    "external_api",
                    "exchangerate-api",
                    fields=["CNY", *currencies],
                    label="exchangerate-api CNY 汇率",
                )
            ],
            evidence_window="本次汇率刷新请求",
            confidence_reason="汇率记录来自外部汇率服务并按市场字典 currency 字段保存。",
            data_gaps=[f"exchange_rates.{currency}" for currency in sorted(set(failed))],
        ),
    })


# ══════════════════════════════════════════
# Profit Calculator
# ══════════════════════════════════════════

@router.post("/profit-calc")
async def profit_calculator(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Multi-market profit simulator.

    Input: { cost_rmb: float, shipping_rmb: float, markup_pct: float, markets: ["MY","PH",...]? }
    Output: [{ market, platform, selling_price, fees, profit_rmb, margin_pct }]
    """
    cost_rmb = float(data.get("cost_rmb", 0))
    shipping_rmb = float(data.get("shipping_rmb", 0))
    if data.get("markup_pct") is None:
        return evidence_response({"results": [], **data_required(
            "请填写目标加价率",
            data_gaps=["markup_pct"],
            evidence_window="当前请求输入",
        )})
    markup_pct = float(data.get("markup_pct"))
    request_markets = data.get("markets")
    if shipping_rmb <= 0:
        return evidence_response({"results": [], **data_required(
            "请填写实际运费",
            data_gaps=["shipping_rmb"],
            evidence_window="当前请求输入",
        )})

    # Get fee templates
    templates = await get_fee_templates(db)
    if not templates:
        return evidence_response({"results": [], **configuration_required(
            "请先配置平台费率",
            data_gaps=["fee_templates"],
            evidence_window="当前费率模板配置",
        )})
    if not request_markets:
        request_markets = sorted({t.get("market") for t in templates if t.get("market")})
    if not request_markets:
        return evidence_response({"results": [], **configuration_required(
            "请先在费率模板中配置市场",
            data_gaps=["fee_templates.market"],
            evidence_window="当前费率模板配置",
        )})
    # Get exchange rates
    rates_list = await get_latest_exchange_rates(db)
    rates = {r["to_currency"]: r["rate"] for r in rates_list}
    if not rates:
        return evidence_response({"results": [], **configuration_required(
            "请先刷新或录入汇率",
            data_gaps=["exchange_rates"],
            evidence_window="当前汇率配置",
        )})
    market_currency = {
        market["id"].upper(): market.get("currency")
        for market in await config_service.get_markets(db)
        if market.get("currency")
    }

    results = []
    refs = []

    for mkt in request_markets:
        mkt_upper = mkt.upper()
        currency = market_currency.get(mkt_upper)
        if not currency:
            continue
        rate = rates.get(currency)
        if not rate:
            continue

        # Find matching fee template
        mkt_templates = [t for t in templates if t.get("market") == mkt_upper]
        if not mkt_templates:
            mkt_templates = [t for t in templates if t.get("market") == mkt_upper]

        for tpl in mkt_templates:
            platform = tpl.get("platform")
            if not platform:
                continue
            refs.extend([
                source_ref(
                    "fee_template",
                    tpl.get("id"),
                    fields=["commission_pct", "transaction_fee_pct", "tech_service_pct"],
                    label=f"{platform}/{mkt_upper} 费率模板",
                    meta={"platform": platform, "market": mkt_upper},
                ),
                source_ref(
                    "exchange_rate",
                    currency,
                    fields=["to_currency", "rate"],
                    label=f"CNY/{currency} 最新汇率",
                    meta={"to_currency": currency},
                ),
            ])
            total_fee_pct = (
                tpl.get("commission_pct", 0)
                + tpl.get("transaction_fee_pct", 0)
                + tpl.get("tech_service_pct", 0)
            )

            # Calculate selling price in local currency
            total_cost_rmb = cost_rmb + shipping_rmb
            selling_local = (total_cost_rmb * (1 + markup_pct / 100)) * rate

            # Calculate fees
            fee_local = selling_local * total_fee_pct / 100

            # Net profit in RMB
            net_local = selling_local - fee_local
            profit_rmb = net_local / rate - total_cost_rmb if rate > 0 else 0
            margin_pct = (profit_rmb / (total_cost_rmb + profit_rmb) * 100) if (total_cost_rmb + profit_rmb) > 0 else 0

            results.append({
                "market": mkt_upper,
                "platform": platform,
                "currency": currency,
                "cost_rmb": round(cost_rmb, 2),
                "shipping_rmb": round(shipping_rmb, 2),
                "total_cost_rmb": round(total_cost_rmb, 2),
                "markup_pct": markup_pct,
                "selling_local": round(selling_local, 2),
                "fee_pct": round(total_fee_pct, 1),
                "fee_local": round(fee_local, 2),
                "exchange_rate": round(rate, 6),
                "profit_rmb": round(profit_rmb, 2),
                "margin_pct": round(margin_pct, 1),
                "is_profitable": profit_rmb > 0,
            })

    # Sort by profit descending
    results.sort(key=lambda x: x["profit_rmb"], reverse=True)
    if not results:
        return evidence_response({"results": [], **configuration_required(
            "当前费率、市场币种或汇率配置无法组合出可测算结果。",
            data_gaps=["fee_templates.market", "markets.currency", "exchange_rates"],
            evidence_window="当前费率模板、市场字典与汇率配置",
        )})

    return evidence_response({
        "status": "ready",
        "input": {
            "cost_rmb": cost_rmb,
            "shipping_rmb": shipping_rmb,
            "markup_pct": markup_pct,
        },
        "markets_compared": len(results),
        "results": results,
        **evidence_payload(
            source_refs=unique_refs(refs),
            evidence_window="当前请求输入 + 当前费率模板 + 最新汇率记录",
            confidence_reason="利润模拟仅使用用户输入成本/运费/加价率、已配置费率模板和当前汇率记录。",
            data_gaps=[],
        ),
    })


def _fee_template_snapshot(fee: Optional[FeeTemplate]) -> Optional[dict]:
    if not fee:
        return None
    return {
        "id": fee.id,
        "platform": fee.platform,
        "market": fee.market,
        "commission_pct": fee.commission_pct,
        "transaction_fee_pct": fee.transaction_fee_pct,
        "tech_service_pct": fee.tech_service_pct,
        "shipping_subsidy": fee.shipping_subsidy,
        "free_shipping_threshold": fee.free_shipping_threshold,
        "vat_pct": fee.vat_pct,
        "notes": fee.notes,
        "is_active": fee.is_active,
    }

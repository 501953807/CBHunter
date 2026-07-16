"""Smart pricing API — DB-backed fee templates, real profit calculations."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import ApiResponse
from app.models.competitor_product import CompetitorProduct
from app.models.exchange_rate import ExchangeRate
from app.models.fee_template import FeeTemplate
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.sourcing_item import SourcingItem
from app.models.user import User
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.content_workbench_service import REQUIRED_CONTENT_GAPS
from app.services.evidence_service import configuration_required, data_required, evidence_payload, source_ref
from app.services.media_readiness_service import media_readiness_from_extra
from app.services.product_service import generate_sku
from app.services.platform_product_field_service import merge_platform_requirements
from app.services.sourcing_work_item_projection_service import build_sourcing_work_item
from app.services.store_access_service import list_accessible_store_ids, list_accessible_store_ids_for_user_id

router = APIRouter(prefix="/pricing", tags=["pricing"], dependencies=[Depends(get_current_user)])


@router.get("/workbench", response_model=ApiResponse)
async def get_pricing_workbench(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SourcingItem)
        .where(
            SourcingItem.user_id == current_user.id,
            SourcingItem.is_active == True,  # noqa: E712
        )
        .order_by(desc(SourcingItem.updated_at))
        .limit(50)
    )
    candidates = [
        item
        for item in result.scalars().all()
        if not _content_confirmation_gaps(item)
    ]
    store_ids = await list_accessible_store_ids(db, current_user)
    stores_result = await db.execute(
        select(PlatformAccount).where(PlatformAccount.id.in_(store_ids))
        if store_ids else select(PlatformAccount).where(PlatformAccount.id == "__none__")
    )
    stores = list(stores_result.scalars().all())
    field_schemas = await config_service.get_platform_product_field_groups(db)
    items = [_pricing_workbench_item(item, stores, field_schemas) for item in candidates]
    status = "ready" if items else "data_required"
    return ApiResponse(
        data={
            "status": status,
            "metrics": {"total": len(items)},
            "items": items,
            "data_gaps": [] if items else ["暂无内容已确认且成本完整的待定价商品"],
            "evidence_window": "当前内容已确认的商品快照",
            "confidence_reason": "定价队列只展示七类内容任务已人工确认，且具备采购价、平台和市场的商品。",
        },
        status=status,
        source_refs=[
            source_ref("sourcing_item", item.id, label=item.product_name)
            for item in candidates
        ],
        evidence_window="当前内容已确认的商品快照",
        confidence_reason="定价队列只展示七类内容任务已人工确认，且具备采购价、平台和市场的商品。",
        data_gaps=[] if items else ["暂无内容已确认且成本完整的待定价商品"],
    )


@router.post("/confirm", response_model=ApiResponse)
async def confirm_pricing(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _bound_pricing_item(db, current_user, data.get("content_item_id"))
    if not item:
        raise HTTPException(status_code=400, detail="请选择待确认价格的商品")
    content_gaps = _content_confirmation_gaps(item)
    if content_gaps:
        missing = data_required(
            "内容任务尚未全部人工确认，不能确认价格。",
            data_gaps=["content_tasks.confirmed", *content_gaps],
            evidence_window="当前商品内容任务确认状态",
            confidence_reason="价格确认只允许处理内容已人工确认的商品。",
            source_refs=[source_ref("sourcing_item", item.id, label=item.product_name)],
        )
        return ApiResponse(data={
            "status": "data_required",
            "content_item_id": item.id,
            "recommendations": {},
            "note": "内容任务尚未全部人工确认，不能确认价格。",
            **missing,
        }, status=missing["status"], source_refs=missing["source_refs"],
           evidence_window=missing["evidence_window"], confidence_reason=missing["confidence_reason"],
           data_gaps=missing["data_gaps"])

    selling_price_local = _positive_float(data.get("selling_price_local"), "请确认有效的本地售价")
    selling_price_rmb = _positive_float(data.get("selling_price_rmb"), "请确认有效的人民币售价")
    account = await _select_pricing_account(db, current_user.id, item.platform, data.get("platform_account_id"))
    if not account:
        missing = configuration_required(
            "未找到当前平台可用店铺，无法创建 Listing 草稿。",
            data_gaps=["platform_accounts"],
            evidence_window="当前用户可访问店铺",
            source_refs=[source_ref("sourcing_item", item.id, label=item.product_name)],
        )
        return ApiResponse(data={
            "status": "configuration_required",
            "content_item_id": item.id,
            "note": "未找到当前平台可用店铺，无法创建 Listing 草稿。",
            **missing,
        }, status=missing["status"], source_refs=missing["source_refs"],
           evidence_window=missing["evidence_window"], confidence_reason=missing["confidence_reason"],
           data_gaps=missing["data_gaps"])

    product = await _product_for_pricing_item(db, current_user.id, item)
    confirmation = {
        "selling_price_rmb": selling_price_rmb,
        "selling_price_local": selling_price_local,
        "currency": data.get("currency"),
        "pricing_tier": data.get("pricing_tier"),
        "pricing_mode": data.get("pricing_mode"),
        "target_profit_pct": data.get("target_profit_pct"),
        "platform_account_id": account.id,
        "product_id": product.id,
    }
    listing = await _upsert_pricing_listing_draft(db, current_user.id, product, item, account, selling_price_local, confirmation)
    item.selling_price_local = selling_price_local
    item.pipeline_stage = "price_confirmed"
    extra = dict(item.extra_data or {})
    extra["pricing_confirmation"] = {**confirmation, "listing_id": listing.id}
    item.extra_data = extra
    await db.flush()
    await record_audit_event(
        db,
        user=current_user,
        action="confirm",
        resource_type="pricing",
        resource_id=item.id,
        new_value={**confirmation, "listing_id": listing.id},
        detail="确认商品定价并创建本地 Listing 草稿",
    )

    evidence = evidence_payload(
        source_refs=[
            source_ref("sourcing_item", item.id, label=item.product_name),
            source_ref("product", product.id, label=product.name),
            source_ref("platform_listing", listing.id, label=listing.title),
            source_ref("platform_account", account.id, label=account.account_name),
        ],
        evidence_window="当前定价确认与本地 Listing 草稿",
        confidence_reason="价格确认写入本地草稿，不代表平台真实发布；发布仍需后续平台刊登确认。",
        data_gaps=[],
    )
    return ApiResponse(data={
        "status": "price_confirmed",
        "content_item_id": item.id,
        "product_id": product.id,
        "listing_id": listing.id,
        "platform_account_id": account.id,
        "selling_price_local": selling_price_local,
        "selling_price_rmb": selling_price_rmb,
        **evidence,
    }, status="ready", source_refs=evidence["source_refs"],
       evidence_window=evidence["evidence_window"], confidence_reason=evidence["confidence_reason"],
       data_gaps=evidence["data_gaps"])


@router.post("/recommend")
async def recommend_price(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recommend selling price based on DB fee templates.

    Input: { source_price_rmb, platform, market, target_profit_pct, pricing_mode }

    Returns 3 tiers: conservative / balanced / aggressive with real fee breakdown.
    """
    bound_item = await _bound_pricing_item(db, current_user, data.get("content_item_id"))
    if bound_item:
        content_gaps = _content_confirmation_gaps(bound_item)
        if content_gaps:
            missing = data_required(
                "内容任务尚未全部人工确认，不能进入定价校验。",
                data_gaps=["content_tasks.confirmed", *content_gaps],
                evidence_window="当前商品内容任务确认状态",
                confidence_reason="定价校验只允许处理已完成人工确认的 Listing 内容商品。",
                source_refs=[source_ref("sourcing_item", bound_item.id, label=bound_item.product_name)],
            )
            return ApiResponse(data={
                "status": "data_required",
                "content_item_id": bound_item.id,
                "product_name": bound_item.product_name,
                "source_price_rmb": bound_item.source_price_rmb,
                "platform": bound_item.platform,
                "market": bound_item.market,
                "fee_breakdown": None,
                "estimated_fee_pct": None,
                "recommendations": {},
                "note": "内容任务尚未全部人工确认，不能进入定价校验。",
                **missing,
            }, status=missing["status"], source_refs=missing["source_refs"],
               evidence_window=missing["evidence_window"], confidence_reason=missing["confidence_reason"],
               data_gaps=missing["data_gaps"])

    source_price_value = bound_item.source_price_rmb if bound_item else data.get("source_price_rmb")
    platform = bound_item.platform if bound_item else data.get("platform")
    market = bound_item.market if bound_item else data.get("market")
    target_profit_pct = data.get("target_profit_pct")
    pricing_mode = data.get("pricing_mode")

    if source_price_value is None or float(source_price_value) <= 0:
        raise HTTPException(status_code=400, detail="请填写真实采购价")
    source_price = float(source_price_value)
    if not platform:
        raise HTTPException(status_code=400, detail="请选择平台")
    if not market:
        raise HTTPException(status_code=400, detail="请选择市场")
    if target_profit_pct is None:
        raise HTTPException(status_code=400, detail="请填写目标利润率")
    if pricing_mode not in ("cost_based", "selling_based"):
        raise HTTPException(status_code=400, detail="定价策略无效")

    target_profit = float(target_profit_pct)
    currency = None
    exchange_rate = None
    if bound_item:
        currency = await _market_currency(db, market)
        exchange_rate = await _latest_exchange_rate(db, currency)
        if not currency or not exchange_rate:
            missing = configuration_required(
                "目标市场汇率未配置，无法计算本地币种售价。",
                data_gaps=["exchange_rates"],
                evidence_window="当前市场字典与汇率记录",
                source_refs=[source_ref("sourcing_item", bound_item.id, label=bound_item.product_name)],
            )
            return ApiResponse(data={
                "status": "configuration_required",
                "content_item_id": bound_item.id,
                "product_name": bound_item.product_name,
                "source_price_rmb": source_price,
                "platform": platform,
                "market": market,
                "currency": currency,
                "fee_breakdown": None,
                "estimated_fee_pct": None,
                "recommendations": {},
                "note": "目标市场汇率未配置，无法计算本地币种售价。",
                **missing,
            }, status=missing["status"], source_refs=missing["source_refs"],
               evidence_window=missing["evidence_window"], confidence_reason=missing["confidence_reason"],
               data_gaps=missing["data_gaps"])

    # Query DB fee template
    result = await db.execute(
        select(FeeTemplate).where(
            FeeTemplate.platform == platform,
            FeeTemplate.market == market,
            FeeTemplate.is_active == True,
        )
    )
    fee = result.scalar_one_or_none()

    if not fee:
        fee_label = await _fee_label(db, platform, market)
        missing = configuration_required(
            f"{fee_label}费率未配置，无法计算真实推荐售价。",
            data_gaps=["fee_templates"],
            evidence_window="当前费率模板配置",
        )
        return ApiResponse(data={
            "source_price_rmb": source_price,
            "platform": platform,
            "market": market,
            "fee_breakdown": None,
            "estimated_fee_pct": None,
            "recommendations": {},
            "note": f"{fee_label}费率未配置，无法计算真实推荐售价。",
            **missing,
        }, status=missing["status"], source_refs=missing["source_refs"],
           evidence_window=missing["evidence_window"], confidence_reason=missing["confidence_reason"],
           data_gaps=missing["data_gaps"])
    if any(value is None for value in (
        fee.commission_pct, fee.transaction_fee_pct, fee.tech_service_pct
    )):
        missing = configuration_required(
            "该平台/市场费率配置不完整，无法计算真实推荐售价。",
            data_gaps=["fee_templates.commission_pct", "fee_templates.transaction_fee_pct", "fee_templates.tech_service_pct"],
            evidence_window="当前费率模板配置",
            source_refs=[source_ref("fee_template", fee.id, label=f"{platform}/{market} 费率模板")],
        )
        return ApiResponse(data={
            "source_price_rmb": source_price,
            "platform": platform,
            "market": market,
            "fee_breakdown": None,
            "estimated_fee_pct": None,
            "recommendations": {},
            "note": "该平台/市场费率配置不完整，无法计算真实推荐售价。",
            **missing,
        }, status=missing["status"], source_refs=missing["source_refs"],
           evidence_window=missing["evidence_window"], confidence_reason=missing["confidence_reason"],
           data_gaps=missing["data_gaps"])

    total_fee_pct = round(fee.commission_pct + fee.transaction_fee_pct + fee.tech_service_pct, 1)
    fee_breakdown = {
        "commission_pct": fee.commission_pct,
        "transaction_fee_pct": fee.transaction_fee_pct,
        "tech_service_pct": fee.tech_service_pct,
        "source": "已配置费率",
    }
    competitor_band = None
    competitor_refs = []
    if bound_item and currency:
        competitor_band, competitor_refs = await _competitor_price_band(
            db,
            current_user.id,
            platform,
            market,
            currency,
        )

    def calc_price(margin_pct: float) -> float:
        if pricing_mode == "cost_based":
            return round(source_price * (1 + margin_pct / 100) / (1 - total_fee_pct / 100), 2)
        divisor = 1 - (total_fee_pct / 100) - (margin_pct / 100)
        return round(source_price / divisor, 2)

    if target_profit <= 0 or target_profit + 20 >= 100 - total_fee_pct:
        raise HTTPException(status_code=400, detail="目标利润率与平台费率组合无有效售价区间")

    conservative = calc_price(target_profit)
    balanced = calc_price(target_profit + 10)
    aggressive = calc_price(target_profit + 20)

    def margin_for(price: float) -> float:
        return round(((price - source_price) / max(price, 0.01)) * 100 - total_fee_pct, 1)

    def recommendation(price: float, margin_pct: float, label: str) -> dict:
        net_profit = round(price * (1 - total_fee_pct / 100) - source_price, 2)
        payload = {
            "selling_price": price,
            "target_margin_pct": round(margin_pct, 1),
            "net_profit_pct": margin_for(price),
            "net_profit_rmb": net_profit,
            "label": label,
        }
        if exchange_rate:
            local_price = round(price * exchange_rate.rate, 2)
            payload["selling_price_local"] = local_price
            payload["currency"] = currency
            if competitor_band:
                payload["competition_position"] = _competition_position(local_price, competitor_band)
        return payload

    source_refs = [
        source_ref(
            "fee_template",
            fee.id,
            fields=["commission_pct", "transaction_fee_pct", "tech_service_pct"],
            label=f"{platform}/{market} 费率模板",
            meta={"platform": platform, "market": market},
        ),
        source_ref("pricing_request", fields=["source_price_rmb", "target_profit_pct", "pricing_mode"]),
    ]
    if bound_item:
        source_refs.append(source_ref(
            "sourcing_item",
            bound_item.id,
            label=bound_item.product_name,
            fields=["source_price_rmb", "platform", "market", "extra_data.content_tasks"],
        ))
    if exchange_rate:
        source_refs.append(source_ref(
            "exchange_rate",
            exchange_rate.id,
            label=f"CNY/{currency}",
            fields=["from_currency", "to_currency", "rate", "fetched_at"],
        ))
    source_refs.extend(competitor_refs)
    pricing_gaps = []
    if bound_item and not competitor_band:
        pricing_gaps.append("competitor_products.price_band")

    evidence = evidence_payload(
        source_refs=source_refs,
        evidence_window="当前商品成本 + 当前费率模板配置 + 当前汇率记录 + 当前目标利润率"
        if bound_item else "当前费率模板配置 + 当前请求采购价/目标利润率",
        confidence_reason="售价和净利润基于当前商品采购价、内容确认状态、利润口径、已配置平台费率和最新汇率计算。"
        if bound_item else "售价和净利润基于当前请求采购价、利润口径及已配置平台费率计算。",
        data_gaps=pricing_gaps,
    )
    return ApiResponse(data={
        "status": "ready",
        "content_item_id": bound_item.id if bound_item else None,
        "product_name": bound_item.product_name if bound_item else data.get("product_name"),
        "source_price_rmb": source_price,
        "platform": platform,
        "market": market,
        "currency": currency,
        "exchange_rate": exchange_rate.rate if exchange_rate else None,
        "competitor_price_band": competitor_band,
        "fee_breakdown": fee_breakdown,
        "estimated_fee_pct": total_fee_pct,
        "recommendations": {
            "conservative": recommendation(conservative, target_profit, "保守定价"),
            "balanced": recommendation(balanced, target_profit + 10, "平衡定价"),
            "aggressive": recommendation(aggressive, target_profit + 20, "激进定价"),
        },
        **evidence,
    }, status="ready", source_refs=evidence["source_refs"], evidence_window=evidence["evidence_window"],
       confidence_reason=evidence["confidence_reason"], data_gaps=evidence["data_gaps"])


async def _fee_label(db: AsyncSession, platform: str, market: str) -> str:
    market_config = next((item for item in await config_service.get_markets(db) if item.get("id") == market), {})
    parts = [platform, market_config.get("id") or market, market_config.get("label"), market_config.get("currency")]
    return " ".join(str(part) for part in parts if part) + " "


def _pricing_workbench_item(item: SourcingItem, stores: list[PlatformAccount], field_schemas: dict | None = None) -> dict:
    pricing_status = "price_confirmed" if item.pipeline_stage == "price_confirmed" else "pricing_required"
    work_item = build_sourcing_work_item(
        item,
        stage_key="pricing",
        status=pricing_status,
        gaps=[],
        route="/pricing",
    )
    return {
        **work_item,
        "id": item.id,
        "product_name": item.product_name,
        "image_url": item.source_image,
        "media_readiness": media_readiness_from_extra(item.extra_data or {}, item.source_image),
        "source_url": item.source_url,
        "source_name": item.source_name,
        "source_price_rmb": item.source_price_rmb,
        "platform": item.platform,
        "market": item.market,
        "pricing_status": pricing_status,
        "platform_requirements": _platform_requirements(item, field_schemas),
        "listing_store_override": _listing_store_override(item),
        "pricing_confirmation": (item.extra_data or {}).get("pricing_confirmation") or {},
        "pricing_inputs": {
            "cost_rmb": item.source_price_rmb,
            "target_platform": item.platform,
            "target_market": item.market,
            "content_confirmed": not _content_confirmation_gaps(item),
        },
        "store_options": [
            {
                "id": store.id,
                "platform": store.platform,
                "account_name": store.account_name,
                "shop_id": store.shop_id,
            }
            for store in stores
            if store.platform == item.platform and store.is_active
        ],
        "next_action": "执行定价校验",
    }


def _platform_requirements(item: SourcingItem, field_schemas: dict | None = None) -> dict:
    requirements = (item.extra_data or {}).get("platform_requirements") or {}
    if not isinstance(requirements, dict):
        return {}
    platform_requirements = requirements.get(item.platform) or {}
    return merge_platform_requirements(platform_requirements, item.platform, field_schemas)


async def _bound_pricing_item(db: AsyncSession, current_user: User, item_id: str | None) -> SourcingItem | None:
    if not item_id:
        return None
    user_id = getattr(current_user, "id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    result = await db.execute(
        select(SourcingItem).where(
            SourcingItem.id == item_id,
            SourcingItem.user_id == user_id,
            SourcingItem.is_active == True,  # noqa: E712
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="待定价商品不存在")
    return item


def _content_confirmation_gaps(item: SourcingItem) -> list[str]:
    tasks = (item.extra_data or {}).get("content_tasks") or {}
    gaps = [
        label
        for task_type, label in REQUIRED_CONTENT_GAPS
        if not tasks.get(task_type, {}).get("confirmed_version")
    ]
    if not item.source_price_rmb or item.source_price_rmb <= 0:
        gaps.append("缺少真实采购成本")
    if not item.platform:
        gaps.append("缺少目标平台")
    if not item.market:
        gaps.append("缺少目标市场")
    return gaps


async def _market_currency(db: AsyncSession, market: str) -> str | None:
    market_config = next((item for item in await config_service.get_markets(db) if item.get("id") == market), {})
    return (market_config.get("currency") or "").upper() or None


async def _latest_exchange_rate(db: AsyncSession, currency: str | None) -> ExchangeRate | None:
    if not currency or currency == "CNY":
        return None
    result = await db.execute(
        select(ExchangeRate)
        .where(ExchangeRate.from_currency == "CNY", ExchangeRate.to_currency == currency)
        .order_by(desc(ExchangeRate.fetched_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _competitor_price_band(
    db: AsyncSession,
    user_id: str,
    platform: str,
    market: str,
    currency: str,
) -> tuple[dict | None, list[dict]]:
    result = await db.execute(
        select(CompetitorProduct)
        .where(
            CompetitorProduct.user_id == user_id,
            CompetitorProduct.platform == platform,
            CompetitorProduct.market == market,
            CompetitorProduct.currency == currency,
            CompetitorProduct.is_tracked == True,  # noqa: E712
            CompetitorProduct.price.is_not(None),
        )
        .order_by(desc(CompetitorProduct.last_updated))
        .limit(30)
    )
    competitors = [
        item
        for item in result.scalars().all()
        if item.price is not None and float(item.price) > 0
    ]
    prices = sorted(float(item.price) for item in competitors)
    if not prices:
        return None, []

    mid = len(prices) // 2
    median = prices[mid] if len(prices) % 2 else (prices[mid - 1] + prices[mid]) / 2
    refs = [
        source_ref(
            "competitor_product",
            item.id,
            label=item.name,
            fields=["price", "currency", "market", "last_updated"],
        )
        for item in competitors[:5]
    ]
    return {
        "currency": currency,
        "sample_count": len(prices),
        "min": round(prices[0], 2),
        "median": round(median, 2),
        "max": round(prices[-1], 2),
    }, refs


def _competition_position(local_price: float, band: dict) -> str:
    if local_price < band["min"]:
        return "below_band"
    if local_price > band["max"]:
        return "above_band"
    return "inside_band"


def _positive_float(value, message: str) -> float:
    if value is None:
        raise HTTPException(status_code=400, detail=message)
    number = float(value)
    if number <= 0:
        raise HTTPException(status_code=400, detail=message)
    return number


async def _select_pricing_account(
    db: AsyncSession,
    user_id: str,
    platform: str,
    platform_account_id: str | None,
) -> PlatformAccount | None:
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    if not store_ids:
        return None
    query = select(PlatformAccount).where(
        PlatformAccount.id.in_(store_ids),
        PlatformAccount.platform == platform,
        PlatformAccount.is_active == True,  # noqa: E712
    )
    if platform_account_id:
        query = query.where(PlatformAccount.id == platform_account_id)
    query = query.order_by(desc(PlatformAccount.updated_at)).limit(1)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def _product_for_pricing_item(db: AsyncSession, user_id: str, item: SourcingItem) -> Product:
    confirmation = (item.extra_data or {}).get("pricing_confirmation") or {}
    if confirmation.get("product_id"):
        existing = await db.get(Product, confirmation["product_id"])
        if existing and existing.user_id == user_id:
            existing.cost_price = item.source_price_rmb
            return existing
    product = Product(
        user_id=user_id,
        sku=generate_sku(),
        name=(item.product_name or "")[:500],
        description=_confirmed_task_content(item, "description"),
        cost_price=item.source_price_rmb,
        category_id=None,
        attributes={"source_sourcing_item_id": item.id, "source_category": item.category},
        images=[item.source_image] if item.source_image else [],
        status="draft",
    )
    db.add(product)
    await db.flush()
    return product


async def _upsert_pricing_listing_draft(
    db: AsyncSession,
    user_id: str,
    product: Product,
    item: SourcingItem,
    account: PlatformAccount,
    selling_price_local: float,
    confirmation: dict,
) -> PlatformListing:
    previous_listing_id = ((item.extra_data or {}).get("pricing_confirmation") or {}).get("listing_id")
    listing = await db.get(PlatformListing, previous_listing_id) if previous_listing_id else None
    if listing and listing.user_id != user_id:
        listing = None
    override = _listing_store_override(item)
    override_title = (override.get("title") or "").strip()
    override_images = [url for url in override.get("image_urls", []) if isinstance(url, str) and url.strip()]
    listing_title = override_title or _confirmed_title(item)
    listing_images = override_images or ([item.source_image] if item.source_image else [])
    if listing is None:
        listing = PlatformListing(
            user_id=user_id,
            product_id=product.id,
            platform_account_id=account.id,
            title=listing_title,
            description=_confirmed_task_content(item, "description"),
            price=selling_price_local,
            stock=0,
            status="draft",
            images=listing_images,
            platform_data={},
        )
        db.add(listing)
    listing.product_id = product.id
    listing.platform_account_id = account.id
    listing.title = listing_title[:500]
    listing.description = _confirmed_task_content(item, "description")
    listing.price = selling_price_local
    listing.status = "draft"
    listing.images = listing_images
    listing.platform_data = {
        **(listing.platform_data or {}),
        "stock_status": "missing",
        "source_sourcing_item_id": item.id,
        "pricing_confirmation": confirmation,
        "listing_store_override": override,
    }
    await db.flush()
    return listing


def _confirmed_title(item: SourcingItem) -> str:
    content = _confirmed_task_content(item, "listing_copy")
    first_line = next((line.strip() for line in content.splitlines() if line.strip()), "")
    return first_line or item.product_name


def _confirmed_task_content(item: SourcingItem, task_type: str) -> str:
    record = ((item.extra_data or {}).get("content_tasks") or {}).get(task_type) or {}
    confirmed_version = record.get("confirmed_version")
    for version in record.get("versions") or []:
        if version.get("version") == confirmed_version:
            return (version.get("content") or "").strip()
    return ""


def _listing_store_override(item: SourcingItem) -> dict:
    content = _confirmed_task_content(item, "listing_store_override")
    if not content:
        return {}
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return {}
    if not isinstance(payload, dict) or payload.get("schema") != "listing_store_override.v1":
        return {}
    images = payload.get("image_urls") if isinstance(payload.get("image_urls"), list) else []
    skus = payload.get("skus") if isinstance(payload.get("skus"), list) else []
    return {
        "schema": payload.get("schema"),
        "store_id": payload.get("store_id"),
        "store_label": payload.get("store_label"),
        "title": payload.get("title"),
        "price": payload.get("price"),
        "currency": payload.get("currency"),
        "image_urls": [url for url in images if isinstance(url, str) and url.strip()],
        "image_count": len([url for url in images if isinstance(url, str) and url.strip()]),
        "sku_count": len([row for row in skus if isinstance(row, dict) and (row.get("seller_sku") or row.get("price"))]),
        "has_logistics": bool((payload.get("logistics_note") or "").strip()),
        "has_compliance": bool((payload.get("compliance_note") or "").strip()),
        "promotion_note": payload.get("promotion_note"),
        "override_boundary": payload.get("override_boundary"),
    }

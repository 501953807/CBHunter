"""Unified ConfigService — single entry point for all system configuration.

Wraps: dictionary, system_config, fee templates, exchange rates, AI providers.
Every service and API handler that needs config MUST go through this service.
"""

import logging
import json
from copy import deepcopy
from pathlib import Path
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.dictionary import get_all_dicts
from app.services.system_config_service import get_config as _get_sys_config
from app.services.system_config_service import get_config_catalog, get_gemini_key, get_pinterest_credentials

logger = logging.getLogger(__name__)
PLATFORM_PRODUCT_FIELD_GROUPS_PATH = Path(__file__).resolve().parents[1] / "data" / "default_platform_product_field_groups.json"
UNIFIED_FIELD_DICTIONARY_PATH = Path(__file__).resolve().parents[1] / "data" / "default_unified_field_dictionary.json"
FIELD_KEY_ALIASES = {
    "category": "category_l3",
    "platform_product_id": "product_id",
    "product_name_cn": "product_title",
    "global_product_sku": "sku_id",
    "seller_sku": "sku_id",
    "model_id": "sku_id",
    "stock": "sku_stock",
    "selling_price": "sku_price",
    "retail_price": "sku_price",
    "declared_price_cny": "supply_price_cny",
    "main_image": "product_images",
    "short_video_required": "product_video",
    "sku_attributes": "sku_name",
}


async def get_platforms(db: AsyncSession) -> list[dict]:
    """Get the runtime platform dictionary."""
    return (await get_all_dicts(db)).get("platforms", [])


async def get_markets(db: AsyncSession) -> list[dict]:
    return (await get_all_dicts(db)).get("markets", [])


async def get_categories(db: AsyncSession) -> list[dict]:
    return (await get_all_dicts(db)).get("categories", [])


async def get_platform_product_field_groups(db: AsyncSession) -> dict:
    """Get platform-specific product field groups observed from seller backends."""
    configured = await get_config_json(db, "platform.product_field_groups")
    if configured:
        return _enrich_platform_field_groups(configured, await get_unified_field_dictionary(db))
    with PLATFORM_PRODUCT_FIELD_GROUPS_PATH.open("r", encoding="utf-8") as f:
        value = json.load(f)
    return _enrich_platform_field_groups(value, await get_unified_field_dictionary(db)) if isinstance(value, dict) else {}


async def get_unified_field_dictionary(db: AsyncSession) -> dict:
    """Get V5 unified field dictionary converted from the 03 field standard table."""
    configured = await get_config_json(db, "platform.unified_field_dictionary")
    if configured:
        return configured
    with UNIFIED_FIELD_DICTIONARY_PATH.open("r", encoding="utf-8") as f:
        value = json.load(f)
    return value if isinstance(value, dict) else {"fields": []}


def _enrich_platform_field_groups(schemas: dict, field_dictionary: dict) -> dict:
    index = {item.get("key"): item for item in field_dictionary.get("fields", []) if isinstance(item, dict)}
    enriched = deepcopy(schemas)
    for platform, schema in enriched.items():
        for group in schema.get("groups", []) if isinstance(schema, dict) else []:
            for field in group.get("fields", []) if isinstance(group, dict) else []:
                key = field.get("key")
                standard = index.get(key) or index.get(FIELD_KEY_ALIASES.get(key))
                if not standard:
                    continue
                platform_map = standard.get("platforms") or {}
                field.setdefault("unified_field_key", standard.get("key"))
                field.setdefault("standard_label", standard.get("label"))
                field.setdefault("data_type", standard.get("data_type"))
                field.setdefault("country_difference", standard.get("country_difference"))
                field.setdefault("platform_field_name", (platform_map.get(platform) or {}).get("field"))
                field.setdefault("miaoshou_field_name", (platform_map.get("miaoshou") or {}).get("field"))
    return enriched


async def get_fee_templates(db: AsyncSession, platform: Optional[str] = None, market: Optional[str] = None) -> list[dict]:
    """Get fee templates, optionally filtered by platform/market."""
    from sqlalchemy import select
    from app.models.fee_template import FeeTemplate

    q = select(FeeTemplate).where(FeeTemplate.is_active == True)
    if platform:
        q = q.where(FeeTemplate.platform == platform)
    if market:
        q = q.where(FeeTemplate.market == market)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [{"platform": r.platform, "market": r.market, "commission_pct": r.commission_pct,
             "transaction_fee_pct": r.transaction_fee_pct, "tech_service_pct": r.tech_service_pct}
            for r in rows]


async def get_exchange_rates(db: AsyncSession) -> list[dict]:
    """Get current exchange rates."""
    from sqlalchemy import func, select
    from app.models.exchange_rate import ExchangeRate

    target_currencies = {
        (market.get("currency") or "").upper()
        for market in await get_markets(db)
        if market.get("currency") and market.get("currency") != "CNY"
    }
    if not target_currencies:
        return []
    latest = (
        select(
            ExchangeRate.to_currency,
            func.max(ExchangeRate.fetched_at).label("max_fetched"),
        )
        .where(ExchangeRate.to_currency.in_(target_currencies))
        .group_by(ExchangeRate.to_currency)
        .subquery()
    )
    result = await db.execute(
        select(ExchangeRate).join(
            latest,
            (ExchangeRate.to_currency == latest.c.to_currency)
            & (ExchangeRate.fetched_at == latest.c.max_fetched),
        )
    )
    return [
        {
            "from_currency": r.from_currency,
            "to_currency": r.to_currency,
            "rate": r.rate,
            "source": r.source,
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
        }
        for r in result.scalars().all()
    ]


async def get_ai_providers(db: AsyncSession) -> list[dict]:
    """Get active AI provider configurations (non-sensitive fields only)."""
    from sqlalchemy import select
    from app.models.ai_provider import AIProviderDef

    result = await db.execute(select(AIProviderDef).where(AIProviderDef.enabled == True))
    return [{"id": r.id, "name": r.name, "type": r.type,
             "capabilities": r.capabilities, "cost_tier": r.cost_tier,
             "needs_key": r.needs_key, "needs_overseas": r.needs_overseas}
            for r in result.scalars().all()]


async def get_config_value(db: AsyncSession, key: str) -> Optional[str]:
    """Read system_config value (auto-decrypts sensitive keys)."""
    value = await _get_sys_config(db, key)
    if value is not None:
        return value
    definition = next((item for item in get_config_catalog() if item.get("key") == key), None)
    default_value = definition.get("default_value") if definition else None
    if default_value is None:
        return None
    return json.dumps(default_value, ensure_ascii=False) if not isinstance(default_value, str) else default_value


async def get_config_json(db: AsyncSession, key: str) -> Optional[dict]:
    """Read an object configuration through the unified config path."""
    raw = await get_config_value(db, key)
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Invalid JSON system config: %s", key)
        return None
    return value if isinstance(value, dict) else None


async def get_all_config(db: AsyncSession) -> dict:
    """Unified init payload — frontend calls once to load everything."""
    dict_data = await get_all_dicts(db)
    return {
        "platforms": dict_data.get("platforms", []),
        "markets": dict_data.get("markets", []),
        "categories": dict_data.get("categories", []),
        "finance_entry_types": dict_data.get("finance_entry_types", []),
        "operation_record_types": dict_data.get("operation_record_types", []),
        "operation_record_statuses": dict_data.get("operation_record_statuses", []),
        "carriers": dict_data.get("carriers", []),
        "shipping_methods": dict_data.get("shipping_methods", []),
        "warehouse_service_types": dict_data.get("warehouse_service_types", []),
        "warehouse_integration_statuses": dict_data.get("warehouse_integration_statuses", []),
        "warehouse_inventory_sync_modes": dict_data.get("warehouse_inventory_sync_modes", []),
        "inventory_alert_severities": dict_data.get("inventory_alert_severities", []),
        "inventory_alert_statuses": dict_data.get("inventory_alert_statuses", []),
        "order_statuses": dict_data.get("order_statuses", []),
        "shipment_statuses": dict_data.get("shipment_statuses", []),
        "product_statuses": dict_data.get("product_statuses", []),
        "platform_listing_statuses": dict_data.get("platform_listing_statuses", []),
        "ai_suggestion_severities": dict_data.get("ai_suggestion_severities", []),
        "trend_directions": dict_data.get("trend_directions", []),
        "competition_levels": dict_data.get("competition_levels", []),
        "signal_heat_levels": dict_data.get("signal_heat_levels", []),
        "sourcing_pipeline_stages": dict_data.get("sourcing_pipeline_stages", []),
        "competitor_alert_conditions": dict_data.get("competitor_alert_conditions", []),
        "platform_product_field_groups": await get_platform_product_field_groups(db),
        "unified_field_dictionary": await get_unified_field_dictionary(db),
    }


async def get_dictionary_admin_config(db: AsyncSession) -> dict:
    """Return persisted dictionaries together with server-owned editor metadata."""
    dictionaries = await get_all_dicts(db)
    definitions = [
        {"id": "categories", "label": "品类", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "markets", "label": "市场", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "platforms", "label": "平台", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "finance_entry_types", "label": "财务类型", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "operation_record_types", "label": "运营类型", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}, {"key": "ledger_entry_type", "label": "关联财务类型"}]},
        {"id": "operation_record_statuses", "label": "运营状态", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "carriers", "label": "承运商", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "shipping_methods", "label": "运输方式", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "warehouse_service_types", "label": "仓储服务类型", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "warehouse_integration_statuses", "label": "仓储 API 状态", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "warehouse_inventory_sync_modes", "label": "库存同步方式", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "inventory_alert_severities", "label": "库存预警级别", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "inventory_alert_statuses", "label": "库存预警状态", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "order_statuses", "label": "订单状态", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}, {"key": "variant", "label": "样式"}, {"key": "allowed_next", "label": "可流转到"}, {"key": "is_exception", "label": "异常状态"}]},
        {"id": "shipment_statuses", "label": "物流状态", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}, {"key": "variant", "label": "样式"}]},
        {"id": "product_statuses", "label": "商品状态", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}, {"key": "variant", "label": "样式"}]},
        {"id": "platform_listing_statuses", "label": "平台 Listing 状态", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}, {"key": "variant", "label": "样式"}]},
        {"id": "ai_suggestion_severities", "label": "AI 建议级别", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}, {"key": "variant", "label": "样式"}]},
        {"id": "trend_directions", "label": "趋势方向", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "competition_levels", "label": "竞争度", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "signal_heat_levels", "label": "信号热度等级", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}, {"key": "min", "label": "最低热度"}, {"key": "tone", "label": "视觉语义"}]},
        {"id": "sourcing_pipeline_stages", "label": "品源管道阶段", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}, {"key": "tone", "label": "视觉语义"}]},
        {"id": "competitor_alert_conditions", "label": "竞品预警条件", "fields": [{"key": "id", "label": "编码"}, {"key": "label", "label": "名称"}]},
        {"id": "seeds", "label": "种子词", "fields": [], "editor": "seed_manager"},
    ]
    return {"dictionaries": dictionaries, "definitions": definitions}


async def get_user_scoped_config(db: AsyncSession, user) -> dict:
    """Return configuration governed by the current user's access scope."""
    from app.services.entitlement_service import get_current_entitlements
    from app.services.permission_service import permission_summary
    from app.services.store_access_service import store_scope_summary

    base = await get_all_config(db)
    fees = await get_fee_templates(db)
    rates = await get_exchange_rates(db)
    providers = await get_ai_providers(db)
    return {
        **base,
        "fees": fees,
        "exchange_rates": rates,
        "ai_providers": providers,
        "permissions": await permission_summary(db, user),
        "store_scope": await store_scope_summary(db, user),
        "entitlements": await get_current_entitlements(db, user),
    }


async def get_config_quality(db: AsyncSession, user) -> dict:
    """Summarize configuration readiness for business modules."""
    from app.services.entitlement_service import get_current_entitlements
    from app.services.evidence_service import evidence_payload, source_ref
    from app.services.store_access_service import store_scope_summary

    platforms = await get_platforms(db)
    markets = await get_markets(db)
    categories = await get_categories(db)
    dict_data = await get_all_dicts(db)
    carriers = dict_data.get("carriers", [])
    shipping_methods = dict_data.get("shipping_methods", [])
    fees = await get_fee_templates(db)
    rates = await get_exchange_rates(db)
    providers = await get_ai_providers(db)
    stores = await store_scope_summary(db, user)
    entitlements = await get_current_entitlements(db, user)
    config_catalog = get_config_catalog()
    payment_specs = {
        code: [item["key"] for item in config_catalog if item.get("quality_code") == code]
        for code in ("wechat_payment", "alipay_payment")
    }
    payment_gaps = {}
    for code, keys in payment_specs.items():
        missing = [key for key in keys if not await _get_sys_config(db, key)]
        payment_gaps[code] = [*missing, f"integration.{code}.gateway_adapter"]

    target_currencies = sorted({
        market.get("currency")
        for market in markets
        if market.get("currency") and market.get("currency") != "CNY"
    })
    rate_currencies = {rate["to_currency"] for rate in rates}
    checks = [
        _quality_check("platforms", "平台字典", bool(platforms), len(platforms), ["dict.platforms"]),
        _quality_check("markets", "市场字典", bool(markets), len(markets), ["dict.markets"]),
        _quality_check("categories", "品类字典", bool(categories), len(categories), ["dict.categories"]),
        _quality_check("carriers", "物流承运商", bool(carriers), len(carriers), ["dict.carriers"]),
        _quality_check("shipping_methods", "运输方式", bool(shipping_methods), len(shipping_methods), ["dict.shipping_methods"]),
        _quality_check(
            "market_currencies",
            "市场币种",
            all(market.get("currency") for market in markets) if markets else False,
            len(target_currencies),
            ["dict.markets.currency"],
        ),
        _quality_check("stores", "平台店铺", bool(stores["stores"]), len(stores["stores"]), ["platform_accounts"]),
        _quality_check("fee_templates", "平台费率", _fees_ready(fees), len(fees), ["fee_templates"]),
        _quality_check(
            "exchange_rates",
            "目标市场汇率",
            all(currency in rate_currencies for currency in target_currencies),
            len(rate_currencies),
            ["exchange_rates"],
        ),
        _quality_check("ai_providers", "AI Provider", bool(providers), len(providers), ["ai_providers"]),
        _quality_check(
            "entitlements",
            "套餐权益",
            not entitlements.get("data_gaps"),
            len(entitlements.get("features", {})),
            entitlements.get("data_gaps") or ["subscription_plans"],
        ),
        _quality_check(
            "wechat_payment",
            "微信支付",
            not payment_gaps["wechat_payment"],
            len(payment_specs["wechat_payment"]) - len(payment_gaps["wechat_payment"]) + 1,
            payment_gaps["wechat_payment"],
        ),
        _quality_check(
            "alipay_payment",
            "支付宝",
            not payment_gaps["alipay_payment"],
            len(payment_specs["alipay_payment"]) - len(payment_gaps["alipay_payment"]) + 1,
            payment_gaps["alipay_payment"],
        ),
    ]
    data_gaps = [gap for item in checks if item["status"] != "ready" for gap in item["data_gaps"]]
    status = "ready" if not data_gaps else "configuration_required"
    return {
        "status": status,
        "checks": checks,
        "data_gaps": data_gaps,
        **evidence_payload(
            source_refs=[
                source_ref("config", "dict"),
                source_ref("config", "platform_accounts"),
                source_ref("config", "fee_templates"),
                source_ref("config", "exchange_rates"),
                source_ref("config", "ai_providers"),
                source_ref("config", "subscription_plans"),
                source_ref("config", "payment_gateway"),
            ],
            evidence_window="当前系统配置快照",
            confidence_reason="配置健康检查只读取统一 ConfigService、店铺授权和套餐权益，不使用模块内硬编码默认值。",
            data_gaps=data_gaps,
        ),
    }


def _quality_check(code: str, label: str, ready: bool, count: int, gaps: list[str]) -> dict:
    return {
        "code": code,
        "label": label,
        "status": "ready" if ready else "configuration_required",
        "count": count,
        "data_gaps": [] if ready else gaps,
    }


def _fees_ready(fees: list[dict]) -> bool:
    if not fees:
        return False
    required = ("commission_pct", "transaction_fee_pct", "tech_service_pct")
    return all(all(item.get(key) is not None for key in required) for item in fees)

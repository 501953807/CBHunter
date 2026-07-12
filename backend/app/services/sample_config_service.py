"""Configuration records required by the validation sample pack."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exchange_rate import ExchangeRate
from app.models.fee_template import FeeTemplate
from app.models.listing_template import ListingTemplate
from app.sample_data.product_validation_pack import (
    EXCHANGE_RATES,
    FEE_TEMPLATES,
    LISTING_TEMPLATES,
    platform_requirements_payload,
)


async def ensure_sample_listing_templates(db: AsyncSession, user_id: str) -> int:
    created = 0
    for item in LISTING_TEMPLATES:
        existing = await db.scalar(select(ListingTemplate).where(
            ListingTemplate.user_id == user_id,
            ListingTemplate.platform == item["platform"],
            ListingTemplate.name == item["name"],
        ))
        template_data = {
            "title_template": item["title_template"],
            "description_template": item["description_template"],
            "attribute_template": platform_requirements_payload(_template_sample(item["platform"]))[item["platform"]],
        }
        if existing:
            existing.template_data = template_data
            existing.is_default = True
            continue
        db.add(ListingTemplate(
            user_id=user_id,
            name=item["name"],
            description="验证样本模板：用于检查 Listing 编写、属性校验和批量刊登草稿。",
            platform=item["platform"],
            template_data=template_data,
            is_default=True,
        ))
        created += 1
    return created


async def ensure_sample_fee_templates(db: AsyncSession) -> int:
    created = 0
    for platform, market, commission, transaction, tech in FEE_TEMPLATES:
        existing = await db.scalar(select(FeeTemplate).where(
            FeeTemplate.platform == platform,
            FeeTemplate.market == market,
            FeeTemplate.is_active == True,  # noqa: E712
        ))
        if existing:
            existing.commission_pct = commission
            existing.transaction_fee_pct = transaction
            existing.tech_service_pct = tech
            existing.notes = "验证样本费率；真实经营前需按平台后台费率复核。"
            continue
        db.add(FeeTemplate(
            platform=platform,
            market=market,
            commission_pct=commission,
            transaction_fee_pct=transaction,
            tech_service_pct=tech,
            notes="验证样本费率；真实经营前需按平台后台费率复核。",
            is_active=True,
        ))
        created += 1
    return created


async def ensure_sample_exchange_rates(db: AsyncSession) -> int:
    created = 0
    for currency, rate in EXCHANGE_RATES.items():
        existing = await db.scalar(select(ExchangeRate).where(
            ExchangeRate.from_currency == "CNY",
            ExchangeRate.to_currency == currency,
        ))
        if existing:
            existing.rate = rate
            existing.source = "sample_pack"
            continue
        db.add(ExchangeRate(from_currency="CNY", to_currency=currency, rate=rate, source="sample_pack"))
        created += 1
    return created


def _template_sample(platform: str) -> dict:
    return {
        "category": "{{category}}",
        "brand": "CBHunter Validation",
        "material": "{{material}}",
        "weight": 0,
        "dims": {"package_cm": ""},
        "variants": [],
        "platform": platform,
        "cn": "",
        "cost": 0,
    }

"""Service for managing product sourcing pipeline.

Tracks products from discovery through JIT testing to VMI/active listing.
Supports TEMU pipeline (discovery→jit_testing→jit_passed→price_review→vmi→active)
and Shopee/TikTok pipeline (discovery→active).
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, or_

from app.models.sourcing_item import SourcingItem
from app.services.dictionary import get_all_dicts
from app.services.finance_service import create_ledger_entry


PIPELINE_STAGES = [
    "discovery",       # Found on 1688, considering
    "jit_testing",     # TEMU JIT mode - testing demand
    "jit_passed",      # TEMU JIT - passed initial tests
    "price_review",    # TEMU - under price review
    "vmi",             # TEMU VMI - bulk stock
    "active",          # Successfully listed/selling
    "discontinued",    # Stopped selling
]

# Stage transition rules: {current_stage: [allowed_next_stages]}
STAGE_TRANSITIONS = {
    "discovery":    ["jit_testing", "active", "discontinued"],
    "jit_testing":  ["jit_passed", "discovery", "discontinued"],
    "jit_passed":   ["price_review", "jit_testing", "discontinued"],
    "price_review": ["vmi", "discovery", "discontinued"],
    "vmi":          ["active", "price_review", "discontinued"],
    "active":       ["discontinued"],
    "discontinued": [],  # terminal stage
}


def validate_stage_transition(current: str, target: str) -> Optional[str]:
    """Validate stage transition. Returns error message or None."""
    if current == target:
        return "目标阶段与当前阶段相同"
    if current not in STAGE_TRANSITIONS:
        return f"未知当前阶段: {current}"
    allowed = STAGE_TRANSITIONS[current]
    if target not in allowed:
        return f"不允许从 {current} 推进到 {target}，允许的目标: {', '.join(allowed)}"
    return None


async def validate_stage_transition_runtime(db: AsyncSession, current: str, target: str) -> Optional[str]:
    """Validate stage transition with runtime dictionary rules."""
    if current == target:
        return "目标阶段与当前阶段相同"
    dictionaries = await get_all_dicts(db)
    stages = dictionaries.get("sourcing_pipeline_stages", [])
    stage_by_id = {item["id"]: item for item in stages}
    if current not in stage_by_id:
        return f"未知当前阶段: {current}"
    if target not in stage_by_id:
        return f"未知目标阶段: {target}"
    allowed = stage_by_id[current].get("allowed_next") or []
    if target not in allowed:
        return f"不允许从 {current} 推进到 {target}，允许的目标: {', '.join(allowed)}"
    return None


def get_transition_requirements(stage: str) -> list[str]:
    """Get requirements/checks needed before transitioning to a stage."""
    checks = {
        "jit_testing":  ["需填写采购价 > 0", "需填写目标市场和平台"],
        "jit_passed":   ["需有供应商信息", "需通过 JIT 测试"],
        "price_review": ["需填写售价", "需完成成本核算"],
        "vmi":          ["需通过价格审核", "需填写 listing URL"],
        "active":       ["需填写上架链接", "需至少一个优选供应商"],
    }
    return checks.get(stage, [])


async def list_items(
    db: AsyncSession,
    user_id: str,
    platform: Optional[str] = None,
    pipeline_stage: Optional[str] = None,
    category: Optional[str] = None,
    market: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[SourcingItem], int]:
    """List sourcing items with filters and pagination."""
    query = select(SourcingItem).where(SourcingItem.user_id == user_id)

    if platform:
        query = query.where(SourcingItem.platform == platform)
    if pipeline_stage:
        query = query.where(SourcingItem.pipeline_stage == pipeline_stage)
    if category:
        query = query.where(SourcingItem.category == category)
    if market:
        query = query.where(SourcingItem.market == market)
    if search:
        query = query.where(
            or_(
                SourcingItem.product_name.ilike(f"%{search}%"),
                SourcingItem.product_name_cn.ilike(f"%{search}%"),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(SourcingItem.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def create_item(db: AsyncSession, user_id: str, data: dict) -> SourcingItem:
    """Create a new sourcing item."""
    source_price = data.get("source_price_rmb")
    extra_data = dict(data.get("extra_data") or {})
    if source_price is None or source_price <= 0:
        source_price = None
        extra_data["source_price_status"] = "missing"
    else:
        extra_data["source_price_status"] = "confirmed"
    item = SourcingItem(
        user_id=user_id,
        source_name=data.get("source_name", "1688"),
        source_url=data.get("source_url"),
        source_image=data.get("source_image"),
        source_price_rmb=source_price,
        product_name=data.get("product_name", ""),
        extra_data=extra_data,
        product_name_cn=data.get("product_name_cn"),
        weight_g=data.get("weight_g"),
        category=data.get("category"),
        platform=data.get("platform"),
        market=data.get("market"),
        pipeline_stage=data.get("pipeline_stage", "discovery"),
        notes=data.get("notes"),
        tags=data.get("tags", []),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_item(db: AsyncSession, item_id: str, user_id: str, data: dict) -> Optional[SourcingItem]:
    """Update a sourcing item."""
    result = await db.execute(
        select(SourcingItem).where(
            SourcingItem.id == item_id,
            SourcingItem.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return None

    for field, value in data.items():
        if value is not None and hasattr(item, field):
            setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


async def delete_item(db: AsyncSession, item_id: str, user_id: str) -> bool:
    """Delete a sourcing item."""
    result = await db.execute(
        delete(SourcingItem).where(
            SourcingItem.id == item_id,
            SourcingItem.user_id == user_id,
        )
    )
    await db.commit()
    return result.rowcount > 0


async def advance_stage(
    db: AsyncSession, item_id: str, user_id: str, target_stage: str
) -> tuple[Optional[SourcingItem], Optional[str]]:
    """Advance pipeline stage with validation. Returns (item, error)."""
    result = await db.execute(
        select(SourcingItem).where(
            SourcingItem.id == item_id,
            SourcingItem.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return None, "选品不存在"

    error = await validate_stage_transition_runtime(db, item.pipeline_stage, target_stage)
    if error:
        return item, error

    # Pre-advancement checks
    if target_stage == "jit_testing":
        if not item.source_price_rmb or item.source_price_rmb <= 0:
            return item, "请先填写采购价"
        if not item.market or not item.platform:
            return item, "请先填写目标市场和平台"
    elif target_stage in ("price_review", "vmi"):
        if not item.selling_price_local or item.selling_price_local <= 0:
            return item, "请先填写售价"

    item.pipeline_stage = target_stage
    await db.commit()
    await db.refresh(item)
    return item, None


async def get_pipeline_summary(db: AsyncSession, user_id: str) -> dict:
    """Get summary of pipeline across runtime-configured stages."""
    result = await db.execute(
        select(SourcingItem).where(SourcingItem.user_id == user_id)
    )
    items = list(result.scalars().all())
    dictionaries = await get_all_dicts(db)
    stages = dictionaries.get("sourcing_pipeline_stages", [])

    summary = {
        "total": len(items),
        "by_platform": {},
    }
    for stage in stages:
        summary[stage["id"]] = 0

    for item in items:
        stage = item.pipeline_stage
        if stage not in summary:
            summary[stage] = 0
        summary[stage] += 1

        platform = item.platform or "unspecified"
        if platform not in summary["by_platform"]:
            summary["by_platform"][platform] = 0
        summary["by_platform"][platform] += 1

    return summary


async def record_purchase_ledger(
    db: AsyncSession,
    item_id: str,
    user_id: str,
    data: dict,
) -> tuple[Optional[dict], Optional[str]]:
    """Record purchase and domestic shipping costs for a sourcing item."""
    result = await db.execute(
        select(SourcingItem).where(
            SourcingItem.id == item_id,
            SourcingItem.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return None, "Sourcing item not found"

    quantity = int(data.get("quantity") or 0)
    unit_cost_rmb = float(data.get("unit_cost_rmb") or 0)
    domestic_shipping_rmb = float(data.get("domestic_shipping_rmb") or 0)
    if quantity <= 0 or unit_cost_rmb < 0 or domestic_shipping_rmb < 0:
        return None, "采购数量和金额必须为非负，数量必须大于0"

    supplier_id = data.get("supplier_id")
    purchase_amount = round(quantity * unit_cost_rmb, 2)
    entries = []
    purchase_entry = await create_ledger_entry(db, user_id, {
        "entry_type": "purchase_cost",
        "amount_rmb": purchase_amount,
        "currency": "CNY",
        "sourcing_item_id": item.id,
        "description": data.get("description") or f"采购成本: {item.product_name}",
        "extra": {
            "source": "sourcing_purchase",
            "quantity": quantity,
            "unit_cost_rmb": unit_cost_rmb,
            "supplier_id": supplier_id,
        },
    })
    entries.append(purchase_entry)

    if domestic_shipping_rmb > 0:
        shipping_entry = await create_ledger_entry(db, user_id, {
            "entry_type": "domestic_shipping",
            "amount_rmb": domestic_shipping_rmb,
            "currency": "CNY",
            "sourcing_item_id": item.id,
            "description": f"国内运费: {item.product_name}",
            "extra": {"source": "sourcing_purchase", "supplier_id": supplier_id},
        })
        entries.append(shipping_entry)

    return {
        "entries": [
            {"id": entry.id, "entry_type": entry.entry_type, "amount_rmb": entry.amount_rmb}
            for entry in entries
        ],
        "total_rmb": round(purchase_amount + domestic_shipping_rmb, 2),
    }, None


def calculate_cost(data: dict) -> dict:
    """
    Calculate total cost, profit, and margin.
    All monetary values in RMB unless specified.
    """
    required_fields = [
        "source_price_rmb", "selling_price_local", "domestic_shipping_rmb",
        "intl_shipping_rmb", "packaging_cost_rmb", "platform_fee_pct",
        "payment_fee_pct", "return_reserve_pct", "exchange_rate",
    ]
    missing = [field for field in required_fields if data.get(field) is None]
    if missing:
        raise ValueError(f"Missing cost fields: {', '.join(missing)}")
    if data["source_price_rmb"] <= 0:
        raise ValueError("source_price_rmb must be greater than 0")
    if data["selling_price_local"] <= 0:
        raise ValueError("selling_price_local must be greater than 0")
    if data["exchange_rate"] <= 0:
        raise ValueError("exchange_rate must be greater than 0")
    for field in ("domestic_shipping_rmb", "intl_shipping_rmb", "packaging_cost_rmb", "platform_fee_pct", "payment_fee_pct", "return_reserve_pct"):
        if data[field] < 0:
            raise ValueError(f"{field} must not be negative")

    purchase_price = data["source_price_rmb"]
    selling_price = data["selling_price_local"]
    domestic_shipping = data["domestic_shipping_rmb"]
    intl_shipping = data["intl_shipping_rmb"]
    packaging = data["packaging_cost_rmb"]
    exchange_rate = data["exchange_rate"]

    platform_fee_pct = data["platform_fee_pct"]
    payment_fee_pct = data["payment_fee_pct"]
    return_reserve_pct = data["return_reserve_pct"]

    # Convert selling price to RMB
    selling_rmb = selling_price / exchange_rate

    # Fixed costs (RMB)
    fixed_cost = purchase_price + domestic_shipping + intl_shipping + packaging

    # Variable costs (percentage-based on selling price in RMB)
    platform_fee = selling_rmb * platform_fee_pct / 100
    payment_fee = selling_rmb * payment_fee_pct / 100
    return_reserve = selling_rmb * return_reserve_pct / 100

    total_cost = fixed_cost + platform_fee + payment_fee + return_reserve
    profit = selling_rmb - total_cost
    margin = (profit / selling_rmb * 100) if selling_rmb > 0 else 0

    # Breakeven: how many units to cover fixed costs (not recurring)
    # For single unit analysis, any positive profit means profitable
    breakeven = 1 if profit > 0 else float("inf")

    return {
        "total_cost_rmb": round(total_cost, 2),
        "profit_rmb": round(profit, 2),
        "profit_margin_pct": round(margin, 2),
        "breakeven_units": breakeven,
        "details": {
            "purchase_price_rmb": purchase_price,
            "domestic_shipping_rmb": domestic_shipping,
            "intl_shipping_rmb": intl_shipping,
            "packaging_cost_rmb": packaging,
            "platform_fee_rmb": round(platform_fee, 2),
            "payment_fee_rmb": round(payment_fee, 2),
            "return_reserve_rmb": round(return_reserve, 2),
            "selling_price_rmb": round(selling_rmb, 2),
            "exchange_rate": exchange_rate,
        },
    }

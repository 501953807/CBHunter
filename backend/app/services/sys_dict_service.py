"""System dictionary service — seed, CRUD, user overrides."""

import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.sys_dict import SysDictItem
from app.services.dictionary import (
    AI_SUGGESTION_SEVERITIES,
    CATEGORIES,
    FINANCE_ENTRY_TYPES,
    MARKETS,
    OPERATION_RECORD_STATUSES,
    OPERATION_RECORD_TYPES,
    PLATFORMS,
    CARRIERS,
    COMPETITOR_ALERT_CONDITIONS,
    INVENTORY_ALERT_SEVERITIES,
    INVENTORY_ALERT_STATUSES,
    SHIPPING_METHODS,
    ORDER_STATUSES,
    PLATFORM_LISTING_STATUSES,
    PRODUCT_STATUSES,
    SHIPMENT_STATUSES,
    COMPETITION_LEVELS,
    SIGNAL_HEAT_LEVELS,
    SOURCING_PIPELINE_STAGES,
    TREND_DIRECTIONS,
    WAREHOUSE_INTEGRATION_STATUSES,
    WAREHOUSE_INVENTORY_SYNC_MODES,
    WAREHOUSE_SERVICE_TYPES,
)

logger = logging.getLogger(__name__)
VALUE_SCOPED_TYPES = {
    "inventory_alert_severity",
    "inventory_alert_status",
    "order_status",
    "shipment_status",
    "product_status",
    "platform_listing_status",
    "ai_suggestion_severity",
    "competition_level",
    "sourcing_pipeline_stage",
}

def _seed_rows() -> list[dict]:
    rows: list[dict] = []
    for idx, platform in enumerate(PLATFORMS, start=1):
        rows.append(_dict_row(platform, "platform", idx * 10))
    for idx, market in enumerate(MARKETS, start=1):
        rows.append(_dict_row(market, "market", idx * 10))
    for idx, category in enumerate(CATEGORIES, start=1):
        rows.append(_dict_row(category, "category", idx * 10))
    for idx, item in enumerate(FINANCE_ENTRY_TYPES, start=1):
        rows.append(_dict_row(item, "finance_entry_type", idx * 10))
    for idx, item in enumerate(OPERATION_RECORD_TYPES, start=1):
        rows.append(_dict_row(item, "operation_record_type", idx * 10))
    for idx, item in enumerate(OPERATION_RECORD_STATUSES, start=1):
        rows.append(_dict_row(item, "operation_record_status", idx * 10))
    for idx, item in enumerate(CARRIERS, start=1):
        rows.append(_dict_row(item, "carrier", idx * 10))
    for idx, item in enumerate(SHIPPING_METHODS, start=1):
        rows.append(_dict_row(item, "shipping_method", idx * 10))
    for idx, item in enumerate(WAREHOUSE_SERVICE_TYPES, start=1):
        rows.append(_dict_row(item, "warehouse_service_type", idx * 10))
    for idx, item in enumerate(WAREHOUSE_INTEGRATION_STATUSES, start=1):
        rows.append(_dict_row(item, "warehouse_integration_status", idx * 10))
    for idx, item in enumerate(WAREHOUSE_INVENTORY_SYNC_MODES, start=1):
        rows.append(_dict_row(item, "warehouse_inventory_sync_mode", idx * 10))
    for idx, item in enumerate(INVENTORY_ALERT_SEVERITIES, start=1):
        rows.append(_dict_row(item, "inventory_alert_severity", idx * 10))
    for idx, item in enumerate(INVENTORY_ALERT_STATUSES, start=1):
        rows.append(_dict_row(item, "inventory_alert_status", idx * 10))
    for idx, item in enumerate(ORDER_STATUSES, start=1):
        rows.append(_dict_row(item, "order_status", idx * 10))
    for idx, item in enumerate(SHIPMENT_STATUSES, start=1):
        rows.append(_dict_row(item, "shipment_status", idx * 10))
    for idx, item in enumerate(PRODUCT_STATUSES, start=1):
        rows.append(_dict_row(item, "product_status", idx * 10))
    for idx, item in enumerate(PLATFORM_LISTING_STATUSES, start=1):
        rows.append(_dict_row(item, "platform_listing_status", idx * 10))
    for idx, item in enumerate(AI_SUGGESTION_SEVERITIES, start=1):
        rows.append(_dict_row(item, "ai_suggestion_severity", idx * 10))
    for idx, item in enumerate(TREND_DIRECTIONS, start=1):
        rows.append(_dict_row(item, "trend_direction", idx * 10))
    for idx, item in enumerate(COMPETITION_LEVELS, start=1):
        rows.append(_dict_row(item, "competition_level", idx * 10))
    for idx, item in enumerate(SIGNAL_HEAT_LEVELS, start=1):
        rows.append(_dict_row(item, "signal_heat_level", idx * 10))
    for idx, item in enumerate(SOURCING_PIPELINE_STAGES, start=1):
        rows.append(_dict_row(item, "sourcing_pipeline_stage", idx * 10))
    for idx, item in enumerate(COMPETITOR_ALERT_CONDITIONS, start=1):
        rows.append(_dict_row(item, "competitor_alert_condition", idx * 10))
    return rows


def _dict_row(source: dict, dict_type: str, sort_order: int) -> dict:
    extra = {k: v for k, v in source.items() if k not in ("id", "label")}
    row_id = source["id"]
    if dict_type in VALUE_SCOPED_TYPES:
        row_id = f"{dict_type}_{source['id']}"
        extra = {"value": source["id"], **extra}
    return {
        "id": row_id,
        "type": dict_type,
        "label": source["label"],
        "extra": extra,
        "sort_order": sort_order,
    }


async def seed_sys_dict(db: AsyncSession):
    """Seed and backfill system dictionary from default_dictionaries.json."""
    result = await db.execute(select(SysDictItem))
    existing = {item.id: item for item in result.scalars().all()}
    changed = 0
    approved_platform_ids = {item["id"] for item in PLATFORMS}
    approved_market_ids = {item["id"] for item in MARKETS}
    for item in existing.values():
        if item.type == "platform" and item.id not in approved_platform_ids and item.is_active:
            item.is_active = False
            changed += 1
        if item.type == "market" and item.id not in approved_market_ids and item.is_active:
            item.is_active = False
            changed += 1

    for seed in _seed_rows():
        item = existing.get(seed["id"])
        if not item:
            db.add(SysDictItem(**seed))
            changed += 1
            continue

        seed_extra = seed.get("extra") or {}
        merged_extra = {**seed_extra, **(item.extra or {})}
        if merged_extra != (item.extra or {}):
            item.extra = merged_extra
            changed += 1

    if not changed:
        return
    await db.commit()
    logger.info("Seeded/backfilled %s system dictionary items", changed)


async def get_sys_dict(db: AsyncSession, type_filter: Optional[str] = None) -> list[dict]:
    """Get system dictionary items, optionally filtered by type."""
    q = select(SysDictItem).where(SysDictItem.is_active == True).order_by(SysDictItem.type, SysDictItem.sort_order)
    if type_filter:
        q = q.where(SysDictItem.type == type_filter)
    result = await db.execute(q)
    items = result.scalars().all()
    return [
        {"id": i.id, "type": i.type, "label": i.label, "sort_order": i.sort_order, **(i.extra or {})}
        for i in items
    ]


async def get_user_dict(db: AsyncSession, user_id: str) -> dict:
    """Get dictionary merged with user overrides."""
    sys_items = await get_sys_dict(db)

    # Get user overrides
    from app.models.user import User
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    overrides = (user.settings or {}).get("dict_overrides", {}) if user else {}

    result: dict = {
        "platforms": [],
        "markets": [],
        "categories": [],
        "finance_entry_types": [],
        "operation_record_types": [],
        "operation_record_statuses": [],
        "carriers": [],
        "shipping_methods": [],
        "warehouse_service_types": [],
        "warehouse_integration_statuses": [],
        "warehouse_inventory_sync_modes": [],
        "inventory_alert_severities": [],
        "inventory_alert_statuses": [],
        "order_statuses": [],
        "shipment_statuses": [],
        "product_statuses": [],
        "platform_listing_statuses": [],
        "ai_suggestion_severities": [],
        "trend_directions": [],
        "competition_levels": [],
        "signal_heat_levels": [],
        "competitor_alert_conditions": [],
    }
    type_map = {
        "platform": "platforms",
        "market": "markets",
        "category": "categories",
        "finance_entry_type": "finance_entry_types",
        "operation_record_type": "operation_record_types",
        "operation_record_status": "operation_record_statuses",
        "carrier": "carriers",
        "shipping_method": "shipping_methods",
        "warehouse_service_type": "warehouse_service_types",
        "warehouse_integration_status": "warehouse_integration_statuses",
        "warehouse_inventory_sync_mode": "warehouse_inventory_sync_modes",
        "inventory_alert_severity": "inventory_alert_severities",
        "inventory_alert_status": "inventory_alert_statuses",
        "order_status": "order_statuses",
        "shipment_status": "shipment_statuses",
        "product_status": "product_statuses",
        "platform_listing_status": "platform_listing_statuses",
        "ai_suggestion_severity": "ai_suggestion_severities",
        "trend_direction": "trend_directions",
        "competition_level": "competition_levels",
        "signal_heat_level": "signal_heat_levels",
        "competitor_alert_condition": "competitor_alert_conditions",
    }
    for item in sys_items:
        t = item["type"]
        key = type_map.get(t, t + "s")
        if key not in result:
            continue
        oid = item["id"]
        override = overrides.get(oid, True)
        if override is False:
            continue
        entry = {k: v for k, v in item.items() if k != "type"}
        if t in VALUE_SCOPED_TYPES and entry.get("value"):
            entry["id"] = entry["value"]
        result[key].append(entry)

    return result


async def create_sys_item(db: AsyncSession, data: dict) -> SysDictItem:
    """Admin: create a system dictionary item."""
    item = SysDictItem(**data)
    db.add(item)
    await db.commit()
    return item


async def update_sys_item(db: AsyncSession, item_id: str, data: dict) -> Optional[SysDictItem]:
    """Admin: update a system dictionary item."""
    result = await db.execute(select(SysDictItem).where(SysDictItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        return None
    for k, v in data.items():
        if v is not None and hasattr(item, k):
            setattr(item, k, v)
    await db.commit()
    return item


async def delete_sys_item(db: AsyncSession, item_id: str) -> bool:
    """Admin: delete a system dictionary item."""
    result = await db.execute(delete(SysDictItem).where(SysDictItem.id == item_id))
    await db.commit()
    return result.rowcount > 0


def apply_user_overrides(user: Optional[dict], sys_items: list[dict]) -> list[dict]:
    """Merge user overrides into system items."""
    overrides = (user or {}).get("settings", {}).get("dict_overrides", {})
    result = []
    for item in sys_items:
        oid = item["id"]
        ov = overrides.get(oid, True)
        if ov is False:
            continue
        result.append(item)
    return result

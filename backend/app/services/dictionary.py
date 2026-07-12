"""Unified dictionary service.

The JSON file is used only to seed the runtime dictionary table. Runtime reads
must use ``get_all_dicts`` and never silently fall back when the table is empty.
"""

import json
from pathlib import Path

DEFAULT_DICT_PATH = Path(__file__).resolve().parents[1] / "data" / "default_dictionaries.json"


def _load_default_dictionaries() -> dict:
    with DEFAULT_DICT_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


_DEFAULT_DICT = _load_default_dictionaries()
PLATFORMS = _DEFAULT_DICT.get("platforms", [])
MARKETS = _DEFAULT_DICT.get("markets", [])
CATEGORIES = _DEFAULT_DICT.get("categories", [])
FINANCE_ENTRY_TYPES = _DEFAULT_DICT.get("finance_entry_types", [])
OPERATION_RECORD_TYPES = _DEFAULT_DICT.get("operation_record_types", [])
OPERATION_RECORD_STATUSES = _DEFAULT_DICT.get("operation_record_statuses", [])
CARRIERS = _DEFAULT_DICT.get("carriers", [])
SHIPPING_METHODS = _DEFAULT_DICT.get("shipping_methods", [])
WAREHOUSE_SERVICE_TYPES = _DEFAULT_DICT.get("warehouse_service_types", [])
WAREHOUSE_INTEGRATION_STATUSES = _DEFAULT_DICT.get("warehouse_integration_statuses", [])
WAREHOUSE_INVENTORY_SYNC_MODES = _DEFAULT_DICT.get("warehouse_inventory_sync_modes", [])
INVENTORY_ALERT_SEVERITIES = _DEFAULT_DICT.get("inventory_alert_severities", [])
INVENTORY_ALERT_STATUSES = _DEFAULT_DICT.get("inventory_alert_statuses", [])
ORDER_STATUSES = _DEFAULT_DICT.get("order_statuses", [])
SHIPMENT_STATUSES = _DEFAULT_DICT.get("shipment_statuses", [])
PRODUCT_STATUSES = _DEFAULT_DICT.get("product_statuses", [])
PLATFORM_LISTING_STATUSES = _DEFAULT_DICT.get("platform_listing_statuses", [])
AI_SUGGESTION_SEVERITIES = _DEFAULT_DICT.get("ai_suggestion_severities", [])
TREND_DIRECTIONS = _DEFAULT_DICT.get("trend_directions", [])
COMPETITION_LEVELS = _DEFAULT_DICT.get("competition_levels", [])
SIGNAL_HEAT_LEVELS = _DEFAULT_DICT.get("signal_heat_levels", [])
SOURCING_PIPELINE_STAGES = _DEFAULT_DICT.get("sourcing_pipeline_stages", [])
COMPETITOR_ALERT_CONDITIONS = _DEFAULT_DICT.get("competitor_alert_conditions", [])
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

# ══════════════════════════════════════════
# Dictionary CRUD (for Settings page)
# ══════════════════════════════════════════

async def get_all_dicts(db) -> dict:
    """Get all dictionary items grouped by type from sys_dict_items table."""
    from app.models.sys_dict import SysDictItem
    from sqlalchemy import select

    result = await db.execute(
        select(SysDictItem).where(SysDictItem.is_active == True).order_by(SysDictItem.sort_order)
    )
    items = result.scalars().all()

    grouped: dict = {
        "categories": [], "markets": [], "platforms": [], "finance_entry_types": [],
        "operation_record_types": [], "operation_record_statuses": [],
        "carriers": [], "shipping_methods": [], "warehouse_service_types": [],
        "warehouse_integration_statuses": [], "warehouse_inventory_sync_modes": [],
        "inventory_alert_severities": [], "inventory_alert_statuses": [],
        "order_statuses": [], "shipment_statuses": [], "product_statuses": [],
        "platform_listing_statuses": [],
        "ai_suggestion_severities": [],
        "trend_directions": [], "competition_levels": [], "signal_heat_levels": [],
        "sourcing_pipeline_stages": [], "competitor_alert_conditions": [],
    }
    for item in items:
        # SysDictItem.type is 'platform', 'market', 'category', or domain-specific dictionary types.
        mapped_type = {
            "category": "categories",
            "market": "markets",
            "platform": "platforms",
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
            "sourcing_pipeline_stage": "sourcing_pipeline_stages",
            "competitor_alert_condition": "competitor_alert_conditions",
        }.get(item.type)
        if mapped_type and mapped_type in grouped:
            extra = item.extra or {}
            grouped[mapped_type].append({
                "id": extra.get("value") if item.type in VALUE_SCOPED_TYPES and extra.get("value") else item.id,
                "label": item.label,
                "sort_order": item.sort_order,
                **extra,
            })

    return grouped


async def add_dict_item(db, dict_type: str, data: dict) -> dict:
    """Add a dictionary item to sys_dict_items table."""
    from app.models.sys_dict import SysDictItem
    from sqlalchemy import select

    # Map frontend type to DB type.
    db_type = {
        "categories": "category",
        "markets": "market",
        "platforms": "platform",
        "finance_entry_types": "finance_entry_type",
        "operation_record_types": "operation_record_type",
        "operation_record_statuses": "operation_record_status",
        "carriers": "carrier",
        "shipping_methods": "shipping_method",
        "warehouse_service_types": "warehouse_service_type",
        "warehouse_integration_statuses": "warehouse_integration_status",
        "warehouse_inventory_sync_modes": "warehouse_inventory_sync_mode",
        "inventory_alert_severities": "inventory_alert_severity",
        "inventory_alert_statuses": "inventory_alert_status",
        "order_statuses": "order_status",
        "shipment_statuses": "shipment_status",
        "product_statuses": "product_status",
        "platform_listing_statuses": "platform_listing_status",
        "ai_suggestion_severities": "ai_suggestion_severity",
        "trend_directions": "trend_direction",
        "competition_levels": "competition_level",
        "signal_heat_levels": "signal_heat_level",
        "sourcing_pipeline_stages": "sourcing_pipeline_stage",
        "competitor_alert_conditions": "competitor_alert_condition",
    }.get(dict_type, dict_type)

    existing = await db.execute(
        select(SysDictItem).where(SysDictItem.id == data.get("id", ""))
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"ID '{data.get('id')}' 已存在")

    item = SysDictItem(
        id=data.get("id", ""),
        type=db_type,
        label=data.get("label", ""),
        extra={k: v for k, v in data.items() if k not in {"id", "label", "sort_order", "is_active"} and v not in (None, "")},
        sort_order=data.get("sort_order", 99),
        is_active=True,
    )
    db.add(item)
    await db.commit()
    return {"id": item.id, "label": item.label}


async def update_dict_item(db, dict_type: str, item_id: str, data: dict) -> dict:
    """Update a dictionary item."""
    from app.models.sys_dict import SysDictItem
    from sqlalchemy import select

    result = await db.execute(
        select(SysDictItem).where(SysDictItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise ValueError("条目不存在")
    if "label" in data:
        item.label = data["label"]
    extra_updates = {k: v for k, v in data.items() if k not in {"id", "label", "sort_order", "is_active"} and v is not None}
    if extra_updates:
        item.extra = {**(item.extra or {}), **extra_updates}
    await db.commit()
    return {"id": item.id, "label": item.label}


async def delete_dict_item(db, dict_type: str, item_id: str):
    """Delete a dictionary item."""
    from app.models.sys_dict import SysDictItem
    from sqlalchemy import select

    result = await db.execute(
        select(SysDictItem).where(SysDictItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()

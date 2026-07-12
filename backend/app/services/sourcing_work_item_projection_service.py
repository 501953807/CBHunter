"""Shared sourcing-item work-object projections."""

from app.models.sourcing_item import SourcingItem
from app.services.business_work_item_service import enrich_work_item_state
from app.services.evidence_service import source_ref


def build_sourcing_work_item(
    item: SourcingItem,
    *,
    stage_key: str,
    status: str,
    gaps: list[str] | None = None,
    route: str,
) -> dict:
    """Return the unified object-state contract for a sourcing item."""
    item_gaps = gaps or []
    return enrich_work_item_state({
        "id": item.id,
        "type": "sourcing_item",
        "name": item.product_name,
        "stage_key": stage_key,
        "status": status,
        "gaps": item_gaps,
        "data_gaps": item_gaps,
        "source_refs": [source_ref("sourcing_item", item.id, label=item.product_name, meta={"route": route})],
        "platform": item.platform,
        "market": item.market,
        "signal": _signal(item),
    })


def _signal(item: SourcingItem) -> str:
    parts = []
    if item.source_price_rmb is not None:
        parts.append(f"采购价 ¥{item.source_price_rmb}")
    if item.selling_price_local is not None:
        parts.append(f"售价 {item.selling_price_local}")
    if item.profit_margin_pct is not None:
        parts.append(f"利润率 {item.profit_margin_pct}%")
    return "；".join(parts)

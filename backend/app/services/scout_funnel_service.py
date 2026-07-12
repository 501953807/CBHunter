"""Four-layer scout signal funnel projection."""

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.signal import Signal
from app.models.supply_product import SupplyProduct
from app.models.trending_product import TrendingProduct
from app.models.trend_keyword import TrendKeyword
from app.services.scout_source_config import get_scout_source


LAYERS = [
    {"id": "culture", "label": "社交文娱影响"},
    {"id": "trend", "label": "流行趋势"},
    {"id": "platform", "label": "销售平台"},
    {"id": "supply", "label": "供应渠道"},
]


async def get_signal_funnel(db: AsyncSession, user_id: str) -> dict:
    """Build a broad-to-specific funnel from persisted real business records."""
    events = []
    events.extend(await _signal_events(db, user_id))
    events.extend(await _trend_events(db, user_id))
    events.extend(await _platform_events(db, user_id))
    events.extend(await _supply_events(db, user_id))
    events.sort(key=lambda item: item["captured_at"] or "", reverse=True)

    candidates = _merge_candidates(events)
    layers = [
        {
            **layer,
            "signal_count": sum(1 for event in events if event["layer"] == layer["id"]),
            "candidate_count": sum(1 for item in candidates if item["layer_evidence"].get(layer["id"]) == "present"),
            "latest_signals": [event for event in events if event["layer"] == layer["id"]][:5],
        }
        for layer in LAYERS
    ]
    return {
        "metrics": {
            "signal_count": len(events),
            "candidate_count": len(candidates),
            "complete_candidate_count": sum(1 for item in candidates if not item["missing_layers"]),
        },
        "layers": layers,
        "signal_stream": events[:30],
        "candidates": candidates[:20],
    }


async def _signal_events(db: AsyncSession, user_id: str) -> list[dict]:
    rows = await db.execute(
        select(Signal).where(Signal.user_id == user_id, Signal.is_active.is_(True)).order_by(Signal.created_at.desc()).limit(80)
    )
    events = []
    for item in rows.scalars().all():
        source = get_scout_source(item.source) or {}
        events.append(_event(
            layer=item.layer,
            title=item.title,
            source_type="signal",
            source_id=item.id,
            source_name=source.get("name", item.source),
            captured_at=item.created_at,
            detail=item.content,
            route="/scout/sources",
            meta={"converted": item.converted, "source_url": item.source_url},
        ))
    return events


async def _trend_events(db: AsyncSession, user_id: str) -> list[dict]:
    rows = await db.execute(
        select(TrendKeyword)
        .where(or_(TrendKeyword.user_id == user_id, TrendKeyword.user_id.is_(None)))
        .order_by(TrendKeyword.updated_at.desc())
        .limit(80)
    )
    events = []
    for item in rows.scalars().all():
        events.append(_event(
            layer="trend",
            title=item.keyword,
            source_type="trend_keyword",
            source_id=item.id,
            source_name=item.source or "manual",
            captured_at=item.updated_at or item.created_at,
            detail=_join_parts([item.market, item.category, _metric("搜索量", item.search_volume), item.trend_direction]),
            route="/scout/sources",
            meta={"market": item.market, "category": item.category, "growth_pct": item.growth_pct},
        ))
    return events


async def _platform_events(db: AsyncSession, user_id: str) -> list[dict]:
    rows = await db.execute(
        select(TrendingProduct)
        .where(TrendingProduct.user_id == user_id)
        .order_by(TrendingProduct.last_updated.desc())
        .limit(80)
    )
    events = []
    for item in rows.scalars().all():
        events.append(_event(
            layer="platform",
            title=item.name,
            source_type="trending_product",
            source_id=item.id,
            source_name=item.platform,
            captured_at=item.last_updated or item.discovered_at,
            detail=_join_parts([item.market, item.category_path, _metric("销量", item.sales_volume), _price_range(item.price_min, item.price_max)]),
            route="/scout/sources",
            meta={"platform": item.platform, "market": item.market, "product_url": item.product_url},
        ))
    return events


async def _supply_events(db: AsyncSession, user_id: str) -> list[dict]:
    rows = await db.execute(
        select(SupplyProduct)
        .where(SupplyProduct.user_id == user_id, SupplyProduct.is_active.is_(True))
        .order_by(SupplyProduct.last_updated.desc())
        .limit(80)
    )
    events = []
    for item in rows.scalars().all():
        events.append(_event(
            layer="supply",
            title=item.name,
            source_type="supply_product",
            source_id=item.id,
            source_name=item.platform or item.source or "supply",
            captured_at=item.last_updated or item.discovered_at,
            detail=_join_parts([item.category_path, item.shop_name, _price_range(item.price_min, item.price_max)]),
            route="/sourcing",
            meta={"product_url": item.product_url, "added_to_discovery": item.added_to_discovery},
        ))
    return events


def _merge_candidates(events: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for event in events:
        key = _candidate_key(event["title"])
        grouped.setdefault(key, []).append(event)

    candidates = []
    for group in grouped.values():
        layer_evidence = {layer["id"]: "missing" for layer in LAYERS}
        for event in group:
            if event["layer"] in layer_evidence:
                layer_evidence[event["layer"]] = "present"
        missing = [layer["label"] for layer in LAYERS if layer_evidence[layer["id"]] != "present"]
        present = len(LAYERS) - len(missing)
        first = group[0]
        candidates.append({
            "id": _candidate_key(first["title"]),
            "title": first["title"],
            "layer_evidence": layer_evidence,
            "evidence_summary": {"present": present, "total": len(LAYERS), "missing": len(missing)},
            "missing_layers": missing,
            "source_refs": [
                {"type": event["source_type"], "id": event["source_id"], "label": event["title"], "meta": {"layer": event["layer"], "route": event["route"]}}
                for event in group
            ],
            "latest_signal": first,
            "next_action": "进入选品决策" if not missing else f"补齐{missing[0]}证据",
            "next_action_route": "/product-selection" if not missing else "/scout/sources",
        })
    candidates.sort(key=lambda item: (item["evidence_summary"]["present"], item["latest_signal"]["captured_at"] or ""), reverse=True)
    return candidates


def _event(
    layer: str,
    title: str,
    source_type: str,
    source_id: str,
    source_name: str,
    captured_at: Optional[datetime],
    detail: Optional[str],
    route: str,
    meta: Optional[dict[str, Any]] = None,
) -> dict:
    value = captured_at or datetime.now(timezone.utc)
    return {
        "layer": layer,
        "layer_label": _layer_label(layer),
        "title": title,
        "source_type": source_type,
        "source_id": source_id,
        "source_name": source_name,
        "captured_at": value.isoformat() if hasattr(value, "isoformat") else str(value),
        "detail": detail or "待补充证据说明",
        "route": route,
        "meta": meta or {},
    }


def _layer_label(layer: str) -> str:
    return next((item["label"] for item in LAYERS if item["id"] == layer), layer)


def _candidate_key(title: str) -> str:
    return (title or "未命名候选").strip().lower()


def _price_range(price_min: Optional[float], price_max: Optional[float]) -> Optional[str]:
    prices = [price for price in (price_min, price_max) if price is not None]
    if not prices:
        return None
    if len(prices) == 1 or prices[0] == prices[-1]:
        return f"¥{prices[0]:g}"
    return f"¥{prices[0]:g}-¥{prices[-1]:g}"


def _metric(label: str, value: Optional[int]) -> Optional[str]:
    return f"{label}{value}" if value is not None else None


def _join_parts(parts: list[Optional[Any]]) -> str:
    return " · ".join(str(part) for part in parts if part not in (None, ""))

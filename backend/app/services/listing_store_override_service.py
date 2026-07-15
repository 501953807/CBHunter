"""Helpers for confirmed store-level Listing override payloads."""

import json
import logging

logger = logging.getLogger(__name__)


def listing_store_override(item) -> dict:
    tasks = (item.extra_data or {}).get("content_tasks") or {}
    task = tasks.get("listing_store_override") or {}
    confirmed_version = task.get("confirmed_version")
    for version in task.get("versions") or []:
        if version.get("version") != confirmed_version:
            continue
        content = (version.get("content") or "").strip()
        if not content:
            return {}
        try:
            payload = json.loads(content)
        except json.JSONDecodeError as error:
            logger.warning("Invalid listing_store_override content for sourcing item %s: %s", item.id, error)
            return {}
        if isinstance(payload, dict) and payload.get("schema") == "listing_store_override.v1":
            return payload
    return {}


def listing_store_override_summary(payload: dict) -> dict:
    if not payload:
        return {}
    image_urls = payload.get("image_urls") if isinstance(payload.get("image_urls"), list) else []
    skus = payload.get("skus") if isinstance(payload.get("skus"), list) else []
    return {
        "schema": payload.get("schema"),
        "store_id": payload.get("store_id"),
        "store_label": payload.get("store_label"),
        "title": payload.get("title"),
        "image_count": len([url for url in image_urls if isinstance(url, str) and url.strip()]),
        "sku_count": len([row for row in skus if isinstance(row, dict) and (row.get("seller_sku") or row.get("price"))]),
        "has_platform_attributes": bool(override_platform_attributes(payload)),
        "has_logistics": bool(override_logistics(payload).get("weight_g")),
        "has_compliance": bool((payload.get("compliance_note") or "").strip()),
        "override_boundary": payload.get("override_boundary"),
    }


def override_variants(payload: dict) -> list[dict]:
    rows = payload.get("skus") if isinstance(payload.get("skus"), list) else []
    variants = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        sku = (row.get("seller_sku") or "").strip()
        variation = (row.get("variation") or "").strip()
        if not sku and not variation:
            continue
        variants.append({
            "sku": sku,
            "option_1_name": "规格" if variation else "",
            "option_1_value": variation,
            "price": numeric_value(row.get("price")),
            "stock": numeric_value(row.get("stock"), integer=True),
        })
    return variants


def override_master_sku(payload: dict) -> str | None:
    variants = override_variants(payload)
    return variants[0]["sku"] if variants else None


def override_logistics(payload: dict) -> dict:
    note = payload.get("logistics_note")
    if isinstance(note, dict):
        raw = note
    elif isinstance(note, str) and note.strip().startswith("{"):
        try:
            raw = json.loads(note)
        except json.JSONDecodeError:
            raw = {}
    else:
        raw = {}
    weight = numeric_value(raw.get("weight") or raw.get("weight_g"), integer=True)
    length = numeric_value(raw.get("length") or raw.get("length_cm"), integer=True)
    width = numeric_value(raw.get("width") or raw.get("width_cm"), integer=True)
    height = numeric_value(raw.get("height") or raw.get("height_cm"), integer=True)
    return {
        "weight_g": weight,
        "dimensions": {
            "length_cm": length,
            "width_cm": width,
            "height_cm": height,
        } if any(value is not None for value in (length, width, height)) else {},
    }


def override_compliance(payload: dict) -> dict:
    note = (payload.get("compliance_note") or "").strip()
    if not note:
        return {}
    return {
        "condition": "new",
        "certifications": [],
        "restricted_check_status": "passed" if ("通过" in note or "passed" in note.lower()) else "pending_review",
        "manual_review_note": note,
    }


def override_platform_attributes(payload: dict) -> dict:
    note = payload.get("platform_attributes_note")
    if isinstance(note, dict):
        return note
    if isinstance(note, str) and note.strip().startswith("{"):
        try:
            parsed = json.loads(note)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def merge_override_platform_attributes(requirements: dict, payload: dict) -> dict:
    attributes = override_platform_attributes(payload)
    if not attributes:
        return requirements
    values = requirements.get("attribute_values") if isinstance(requirements.get("attribute_values"), dict) else {}
    return {
        **requirements,
        "attribute_values": {
            **values,
            **attributes,
        },
    }


def numeric_value(value, integer: bool = False):
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if integer else number

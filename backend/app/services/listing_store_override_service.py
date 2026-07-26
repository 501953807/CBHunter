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
    image_urls = override_image_urls(payload)
    skus = override_sku_rows(payload)
    return {
        "schema": payload.get("schema"),
        "store_id": payload.get("store_id"),
        "store_label": payload.get("store_label"),
        "title": payload.get("title"),
        "image_count": len(image_urls),
        "sku_count": len(skus),
        "has_platform_attributes": bool(override_platform_attributes(payload)),
        "has_logistics": bool(override_logistics(payload).get("weight_g")),
        "has_compliance": bool((payload.get("compliance_note") or payload.get("compliance") or "").strip()),
        "override_boundary": payload.get("override_boundary") or payload.get("boundary"),
    }


def confirmed_image_slot_plan(item) -> dict:
    tasks = (item.extra_data or {}).get("content_tasks") or {}
    task = tasks.get("image_edit_plan") or {}
    confirmed_version = task.get("confirmed_version")
    if not confirmed_version:
        return {"images": [], "image_slots": []}
    for version in task.get("versions") or []:
        if version.get("version") != confirmed_version:
            continue
        try:
            payload = json.loads(version.get("content") or "{}")
        except json.JSONDecodeError as error:
            logger.warning("Invalid image_edit_plan content for sourcing item %s: %s", item.id, error)
            return {"images": [], "image_slots": []}
        if not isinstance(payload, dict) or payload.get("schema") != "listing_image_slots.v1":
            return {"images": [], "image_slots": []}
        slots = payload.get("slots") if isinstance(payload.get("slots"), list) else []
        normalized_slots = []
        for index, slot in enumerate(slots):
            if not isinstance(slot, dict):
                continue
            url = str(slot.get("image_url") or slot.get("imageUrl") or "").strip()
            if not url:
                continue
            normalized_slots.append({
                "position": slot.get("position") or index + 1,
                "role": slot.get("role") or ("main_image" if index == 0 else f"extra_image_{index + 1}"),
                "label": slot.get("label") or ("主图" if index == 0 else f"辅图 {index + 1}"),
                "image_url": url,
                "asset_name": slot.get("asset_name") or slot.get("assetName") or "",
                "size": slot.get("size") or slot.get("sizeText") or "",
            })
        normalized_slots.sort(key=lambda slot: slot["position"])
        images = list(dict.fromkeys(slot["image_url"] for slot in normalized_slots))
        return {"images": images, "image_slots": normalized_slots}
    return {"images": [], "image_slots": []}


def override_image_urls(payload: dict) -> list[str]:
    urls = payload.get("image_urls") if isinstance(payload.get("image_urls"), list) else []
    slots = payload.get("image_slots") if isinstance(payload.get("image_slots"), list) else []
    normalized = [
        str(url).strip()
        for url in urls
        if isinstance(url, str) and url.strip()
    ]
    for slot in slots:
        if not isinstance(slot, dict):
            continue
        url = str(slot.get("imageUrl") or slot.get("image_url") or "").strip()
        if url:
            normalized.append(url)
    return list(dict.fromkeys(normalized))


def override_sku_rows(payload: dict) -> list[dict]:
    rows = payload.get("skus") if isinstance(payload.get("skus"), list) else []
    rows += payload.get("sku_rows") if isinstance(payload.get("sku_rows"), list) else []
    normalized = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        sku = (row.get("seller_sku") or row.get("merchantSku") or row.get("merchant_sku") or "").strip()
        option_one = str(row.get("optionOne") or row.get("option_1_value") or row.get("option1") or "").strip()
        option_two = str(row.get("optionTwo") or row.get("option_2_value") or row.get("option2") or "").strip()
        price = row.get("price")
        stock = row.get("stock")
        variation = (row.get("variation") or " / ".join(value for value in (option_one, option_two) if value)).strip()
        if not sku and not variation and price in (None, "") and stock in (None, ""):
            continue
        platform_sku = row.get("platformSku") or row.get("platform_sku") or row.get("sku_id")
        dimensions = parse_dimensions(row.get("dimensions") or row.get("package_size") or row.get("packageSize"))
        normalized.append({
            "seller_sku": sku,
            "platform_sku": platform_sku,
            "spu_skc": row.get("spuSkc") or row.get("spu_skc") or row.get("spu") or row.get("skc") or platform_sku,
            "variation": variation,
            "option_1_value": option_one,
            "option_2_value": option_two,
            "price": price,
            "stock": stock,
            "weight": row.get("weight"),
            "weight_g": numeric_value(row.get("weight"), integer=True),
            "dimensions": dimensions,
            "sku_image_role": row.get("skuImageRole") or row.get("sku_image_role"),
            "enabled": row.get("enabled", True),
        })
    return normalized


def override_variants(payload: dict) -> list[dict]:
    rows = override_sku_rows(payload)
    variants = []
    for row in rows:
        if row.get("enabled") is False:
            continue
        sku = (row.get("seller_sku") or "").strip()
        variation = (row.get("variation") or "").strip()
        if not sku and not variation:
            continue
        variants.append({
            "sku": sku,
            "platform_sku": row.get("platform_sku"),
            "spu_skc": row.get("spu_skc"),
            "option_1_name": "规格一" if row.get("option_1_value") else ("规格" if variation else ""),
            "option_1_value": row.get("option_1_value") or variation,
            "option_2_name": "规格二" if row.get("option_2_value") else "",
            "option_2_value": row.get("option_2_value") or "",
            "sku_image_role": row.get("sku_image_role"),
            "price": numeric_value(row.get("price")),
            "stock": numeric_value(row.get("stock"), integer=True),
            "weight_g": row.get("weight_g"),
            "dimensions": row.get("dimensions") or {},
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
    package_size = payload.get("package_size") or payload.get("packageSize") or raw.get("package_size") or ""
    parsed_dimensions = parse_dimensions(package_size)
    weight = numeric_value(raw.get("weight") or raw.get("weight_g") or payload.get("weight"), integer=True)
    length = numeric_value(raw.get("length") or raw.get("length_cm") or parsed_dimensions.get("length_cm"), integer=True)
    width = numeric_value(raw.get("width") or raw.get("width_cm") or parsed_dimensions.get("width_cm"), integer=True)
    height = numeric_value(raw.get("height") or raw.get("height_cm") or parsed_dimensions.get("height_cm"), integer=True)
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
    attributes = payload.get("platform_attributes")
    if isinstance(attributes, dict):
        return attributes
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


def parse_dimensions(value) -> dict:
    if isinstance(value, dict):
        return {
            "length_cm": value.get("length_cm") or value.get("length"),
            "width_cm": value.get("width_cm") or value.get("width"),
            "height_cm": value.get("height_cm") or value.get("height"),
        }
    if not isinstance(value, str) or not value.strip():
        return {}
    parts = [part.strip() for part in value.lower().replace("×", "x").replace("*", "x").split("x")]
    if len(parts) != 3:
        return {}
    return {
        "length_cm": numeric_value(parts[0]),
        "width_cm": numeric_value(parts[1]),
        "height_cm": numeric_value(parts[2]),
    }


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

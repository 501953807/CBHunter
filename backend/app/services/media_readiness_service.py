"""Media readiness helpers shared by content, pricing, and listing projections."""

from typing import Any


MIN_PLATFORM_IMAGES = 5
RECOMMENDED_PLATFORM_IMAGES = 9


def media_readiness_from_extra(
    extra: dict | None,
    images: list[str] | str | None = None,
    image_plan: dict | None = None,
) -> dict[str, Any]:
    stored = extra.get("media_readiness") if isinstance(extra, dict) else None
    slot_plan = image_plan if isinstance(image_plan, dict) else _embedded_image_slot_plan(extra)
    planned_count = _planned_publishable_image_count(slot_plan)
    if planned_count is not None:
        min_images = _safe_positive_int((stored or {}).get("min_platform_images"), MIN_PLATFORM_IMAGES) if isinstance(stored, dict) else MIN_PLATFORM_IMAGES
        recommended_images = _safe_positive_int(
            slot_plan.get("publish_image_limit")
            or ((stored or {}).get("recommended_platform_images") if isinstance(stored, dict) else None)
            or RECOMMENDED_PLATFORM_IMAGES,
            RECOMMENDED_PLATFORM_IMAGES,
        )
        missing_count = max(min_images - planned_count, 0)
        return {
            "captured_image_count": planned_count,
            "missing_image_count": missing_count,
            "min_platform_images": min_images,
            "recommended_platform_images": recommended_images,
            "publish_image_limit": slot_plan.get("publish_image_limit"),
            "retained_image_count": int(slot_plan.get("retained_image_count") or 0),
            "gaps": _default_media_gaps(missing_count),
            "source": slot_plan.get("source") or "confirmed_image_slot_plan",
        }
    if isinstance(stored, dict):
        return {
            "captured_image_count": _safe_positive_int(stored.get("captured_image_count"), 0),
            "missing_image_count": _safe_positive_int(stored.get("missing_image_count"), 0),
            "min_platform_images": _safe_positive_int(stored.get("min_platform_images"), MIN_PLATFORM_IMAGES),
            "recommended_platform_images": _safe_positive_int(stored.get("recommended_platform_images"), RECOMMENDED_PLATFORM_IMAGES),
            "gaps": stored.get("gaps") if isinstance(stored.get("gaps"), list) else [],
            "source": stored.get("source") or "stored_media_readiness",
        }
    image_list = _normalize_images(images)
    missing_count = max(MIN_PLATFORM_IMAGES - len(image_list), 0)
    return {
        "captured_image_count": len(image_list),
        "missing_image_count": missing_count,
        "min_platform_images": MIN_PLATFORM_IMAGES,
        "recommended_platform_images": RECOMMENDED_PLATFORM_IMAGES,
        "gaps": _default_media_gaps(missing_count),
        "source": "derived_from_current_images",
    }


def _normalize_images(images: list[str] | str | None) -> list[str]:
    if isinstance(images, str):
        images = [images] if images else []
    if not isinstance(images, list):
        return []
    return [image for image in images if isinstance(image, str) and image]


def _planned_publishable_image_count(image_plan: dict | None) -> int | None:
    if not isinstance(image_plan, dict):
        return None
    slots = image_plan.get("image_slots")
    if not image_plan.get("source") and not slots and not image_plan.get("publish_image_limit"):
        return None
    value = image_plan.get("publishable_image_count")
    if value is None:
        if not isinstance(slots, list):
            return None
        publish_limit = _safe_positive_int(image_plan.get("publish_image_limit"), RECOMMENDED_PLATFORM_IMAGES)
        count = 0
        for index, slot in enumerate(slots):
            if not isinstance(slot, dict):
                continue
            if not slot.get("image_url") and not slot.get("imageUrl"):
                continue
            publishable = slot.get("publishable")
            if publishable is None:
                publishable = index < publish_limit
            if bool(publishable):
                count += 1
        return count
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _embedded_image_slot_plan(extra: dict | None) -> dict | None:
    if not isinstance(extra, dict):
        return None
    slots = extra.get("image_slots")
    if not isinstance(slots, list):
        return None
    publish_limit = _safe_positive_int(
        extra.get("publish_image_limit") or extra.get("recommended_platform_images"),
        RECOMMENDED_PLATFORM_IMAGES,
    )
    retained_count = 0
    for index, slot in enumerate(slots):
        if not isinstance(slot, dict):
            continue
        if not slot.get("image_url") and not slot.get("imageUrl"):
            continue
        publishable = slot.get("publishable")
        if publishable is None:
            publishable = index < publish_limit
        if not bool(publishable):
            retained_count += 1
    return {
        "image_slots": slots,
        "publish_image_limit": publish_limit,
        "retained_image_count": retained_count,
        "source": "listing_image_slot_plan",
    }


def _safe_positive_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default


def _default_media_gaps(missing_count: int) -> list[str]:
    return [
        "缺少平台辅图",
        "缺少尺寸/规格图",
        "缺少场景使用图",
        "缺少包装或细节图",
    ][:missing_count]

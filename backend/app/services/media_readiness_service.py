"""Media readiness helpers shared by content, pricing, and listing projections."""

from typing import Any


MIN_PLATFORM_IMAGES = 5
RECOMMENDED_PLATFORM_IMAGES = 9


def media_readiness_from_extra(extra: dict | None, images: list[str] | str | None = None) -> dict[str, Any]:
    stored = extra.get("media_readiness") if isinstance(extra, dict) else None
    if isinstance(stored, dict):
        return {
            "captured_image_count": int(stored.get("captured_image_count") or 0),
            "missing_image_count": int(stored.get("missing_image_count") or 0),
            "min_platform_images": int(stored.get("min_platform_images") or MIN_PLATFORM_IMAGES),
            "recommended_platform_images": int(stored.get("recommended_platform_images") or RECOMMENDED_PLATFORM_IMAGES),
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


def _default_media_gaps(missing_count: int) -> list[str]:
    return [
        "缺少平台辅图",
        "缺少尺寸/规格图",
        "缺少场景使用图",
        "缺少包装或细节图",
    ][:missing_count]

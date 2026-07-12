"""Listing draft asset normalization and validation helpers."""

from app.services.media_readiness_service import media_readiness_from_extra


def build_sku_plan(item: dict, selling_price: float | None) -> dict:
    for listing in (item.get("draft_listings") or {}).values():
        if listing.get("sku_plan"):
            return normalize_sku_plan(listing["sku_plan"], item.get("master_sku"), selling_price)
    return normalize_sku_plan(
        {"master_sku": item.get("master_sku"), "variants": item.get("variants") or []},
        item.get("master_sku"),
        selling_price,
    )


def build_media_assets(item: dict) -> dict:
    for listing in (item.get("draft_listings") or {}).values():
        if listing.get("media_assets"):
            return normalize_media_assets(listing["media_assets"], item.get("images"))
    return normalize_media_assets(
        {
            "images": item.get("images") or [],
            "videos": item.get("videos") or [],
            "media_readiness": item.get("media_readiness"),
        },
        item.get("images"),
    )


def build_logistics(item: dict) -> dict:
    for listing in (item.get("draft_listings") or {}).values():
        if listing.get("logistics"):
            return normalize_logistics(listing["logistics"])
    return normalize_logistics({
        "weight_g": item.get("weight_g"),
        "dimensions": item.get("dimensions") or {},
    })


def build_compliance(item: dict) -> dict:
    for listing in (item.get("draft_listings") or {}).values():
        if listing.get("compliance"):
            return normalize_compliance(listing["compliance"])
    base = dict(item.get("compliance") or {})
    if item.get("brand") and not base.get("brand"):
        base["brand"] = item["brand"]
    return normalize_compliance(base)


def normalize_sku_plan(raw: dict | None, master_sku: str | None, selling_price: float | None) -> dict:
    data = raw if isinstance(raw, dict) else {}
    variants = data.get("variants") if isinstance(data.get("variants"), list) else []
    normalized_variants = []
    for index, variant in enumerate(variants):
        if not isinstance(variant, dict):
            continue
        sku = variant.get("sku") or f"{master_sku or 'SKU'}-{index + 1}"
        normalized_variants.append({
            "sku": sku,
            "option_1_name": variant.get("option_1_name") or variant.get("option_name") or "",
            "option_1_value": variant.get("option_1_value") or variant.get("option_value") or "",
            "option_2_name": variant.get("option_2_name") or "",
            "option_2_value": variant.get("option_2_value") or "",
            "price": variant.get("price") if variant.get("price") is not None else selling_price,
            "stock": variant.get("stock") if variant.get("stock") is not None else 0,
        })
    return {
        "master_sku": data.get("master_sku") or master_sku,
        "variant_model": "single" if len(normalized_variants) <= 1 else "multi",
        "variants": normalized_variants,
    }


def normalize_media_assets(raw: dict | None, images: list | str | None) -> dict:
    data = raw if isinstance(raw, dict) else {}
    image_list = data.get("images") if isinstance(data.get("images"), list) else images
    if isinstance(image_list, str):
        image_list = [image_list] if image_list else []
    if not isinstance(image_list, list):
        image_list = []
    videos = data.get("videos") if isinstance(data.get("videos"), list) else []
    main_image = data.get("main_image") or (image_list[0] if image_list else None)
    return {
        "main_image": main_image,
        "images": image_list,
        "videos": videos,
        "media_readiness": media_readiness_from_extra(data, image_list),
        "image_edit_status": data.get("image_edit_status") or "pending_review",
        "video_edit_status": data.get("video_edit_status") or ("pending_review" if videos else "not_provided"),
    }


def normalize_logistics(raw: dict | None) -> dict:
    data = raw if isinstance(raw, dict) else {}
    dimensions = data.get("dimensions") if isinstance(data.get("dimensions"), dict) else {}
    return {
        "weight_g": data.get("weight_g"),
        "dimensions": dimensions,
        "preparation_days": data.get("preparation_days") if data.get("preparation_days") is not None else 2,
        "shipping_template_id": data.get("shipping_template_id"),
        "warehouse_policy": data.get("warehouse_policy") or "platform_fulfillment_or_seller_ship",
    }


def normalize_compliance(raw: dict | None) -> dict:
    data = raw if isinstance(raw, dict) else {}
    certifications = data.get("certifications") if isinstance(data.get("certifications"), list) else []
    return {
        **data,
        "condition": data.get("condition") or "new",
        "certifications": certifications,
        "restricted_check_status": data.get("restricted_check_status") or "pending_review",
    }


def build_validation_checks(
    *,
    title: str | None,
    selling_price: float | None,
    sku_plan: dict,
    media_assets: dict,
    logistics: dict,
    compliance: dict,
    platform_requirements: dict,
    fee_missing: bool,
    blocking_reasons: list[str],
) -> list[dict]:
    variants = sku_plan.get("variants") if isinstance(sku_plan.get("variants"), list) else []
    images = media_assets.get("images") if isinstance(media_assets.get("images"), list) else []
    attribute_values = platform_requirements.get("attribute_values") if isinstance(platform_requirements.get("attribute_values"), dict) else {}
    platform_field_gaps = platform_field_gaps_for_requirements(platform_requirements)
    missing_blocking_attrs = platform_field_gaps["blocking"]
    missing_recheck_attrs = platform_field_gaps["recheck"]
    return [
        _validation_check(
            "title",
            "标题",
            "pass" if title and title.strip() else "block",
            "平台标题已填写。" if title and title.strip() else "平台标题必须在发布前确认。",
        ),
        _validation_check(
            "price",
            "售价",
            "pass" if selling_price and selling_price > 0 else "block",
            "售价已填写。" if selling_price and selling_price > 0 else "售价必须大于 0。",
        ),
        _validation_check(
            "sku",
            "SKU/规格",
            "pass" if sku_plan.get("master_sku") or variants else "warning",
            "SKU 信息可用于平台规格映射。" if sku_plan.get("master_sku") or variants else "建议维护主 SKU 或规格 SKU。",
        ),
        _validation_check(
            "media",
            "图片/视频",
            "pass" if images else "warning",
            "已维护商品图片。" if images else "建议至少维护主图，视频可作为 TikTok Shop 等平台的素材增强。",
        ),
        _validation_check(
            "logistics",
            "物流",
            "pass" if logistics.get("weight_g") else "warning",
            "已维护重量，可继续校验物流模板。" if logistics.get("weight_g") else "建议维护重量和尺寸，便于平台运费校验。",
        ),
        _validation_check(
            "compliance",
            "合规",
            "pass" if compliance.get("restricted_check_status") == "passed" else "warning",
            "禁限售复核已通过。" if compliance.get("restricted_check_status") == "passed" else "禁限售、资质和敏感属性需复核。",
        ),
        _validation_check(
            "platform_fields",
            "平台字段",
            "block" if missing_blocking_attrs else ("warning" if missing_recheck_attrs or not attribute_values else "pass"),
            _platform_fields_message(missing_blocking_attrs, missing_recheck_attrs, bool(attribute_values)),
        ),
        _validation_check(
            "fees",
            "平台费率",
            "block" if fee_missing else "pass",
            "平台费率缺失时只能保存前置补数状态。" if fee_missing else "平台费率已配置。",
        ),
        _validation_check(
            "blocking_reasons",
            "后端阻断",
            "block" if blocking_reasons else "pass",
            " / ".join(blocking_reasons) if blocking_reasons else "没有后端阻断项。",
        ),
    ]


def platform_field_gaps_for_requirements(platform_requirements: dict) -> dict[str, list[str]]:
    values = platform_requirements.get("attribute_values") if isinstance(platform_requirements.get("attribute_values"), dict) else {}
    field_meta: dict[str, dict] = {}
    for group in platform_requirements.get("field_groups") or []:
        if not isinstance(group, dict):
            continue
        for field in group.get("fields") or []:
            if isinstance(field, dict) and field.get("key"):
                field_meta[str(field["key"])] = field

    required_keys = set()
    for key in platform_requirements.get("required_attributes") or []:
        if key:
            required_keys.add(str(key))
    for key, field in field_meta.items():
        if field.get("required"):
            required_keys.add(key)

    blocking: list[str] = []
    recheck: list[str] = []
    for key in sorted(required_keys):
        if values.get(key):
            continue
        field = field_meta.get(key) or {}
        label = field.get("label") or key
        evidence_state = str(field.get("evidence_state") or "")
        if evidence_state.startswith("needs_"):
            recheck.append(label)
        else:
            blocking.append(label)
    return {"blocking": blocking, "recheck": recheck}


def videos_from_attributes(attributes: dict) -> list[str]:
    videos = attributes.get("videos")
    if isinstance(videos, list):
        return [video for video in videos if isinstance(video, str) and video]
    video = attributes.get("video_url")
    return [video] if isinstance(video, str) and video else []


def _validation_check(code: str, label: str, state: str, message: str) -> dict:
    return {
        "code": code,
        "label": label,
        "state": state,
        "message": message,
    }


def _platform_fields_message(blocking: list[str], recheck: list[str], has_values: bool) -> str:
    parts = []
    if blocking:
        parts.append("仍缺平台已确认必填字段：" + "、".join(blocking))
    if recheck:
        parts.append("待补证字段暂不阻断：" + "、".join(recheck))
    if parts:
        return "；".join(parts)
    return "平台字段已有属性值。" if has_values else "平台字段值待补齐。"

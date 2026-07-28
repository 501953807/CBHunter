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
            "image_slots": item.get("image_slots") or [],
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
            "enabled": variant.get("enabled", True),
            "sku": sku,
            "platform_sku": variant.get("platform_sku") or variant.get("platformSku"),
            "spu_skc": variant.get("spu_skc") or variant.get("spuSkc"),
            "variation": variant.get("variation"),
            "option_1_name": variant.get("option_1_name") or variant.get("option_name") or "",
            "option_1_value": variant.get("option_1_value") or variant.get("option_value") or "",
            "option_2_name": variant.get("option_2_name") or "",
            "option_2_value": variant.get("option_2_value") or "",
            "sku_image_role": variant.get("sku_image_role") or variant.get("skuImageRole"),
            "sku_image_url": variant.get("sku_image_url") or variant.get("skuImageUrl"),
            "price": variant.get("price") if variant.get("price") is not None else selling_price,
            "stock": variant.get("stock") if variant.get("stock") is not None else 0,
            "weight_g": variant.get("weight_g") or variant.get("weight"),
            "dimensions": variant.get("dimensions") if isinstance(variant.get("dimensions"), dict) else {},
            "barcode": variant.get("barcode"),
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
    image_slots = data.get("image_slots") if isinstance(data.get("image_slots"), list) else []
    main_image = data.get("main_image") or (image_list[0] if image_list else None)
    return {
        "main_image": main_image,
        "images": image_list,
        "image_slots": image_slots,
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
    platform: str | None = None,
) -> list[dict]:
    variants = sku_plan.get("variants") if isinstance(sku_plan.get("variants"), list) else []
    images = media_assets.get("images") if isinstance(media_assets.get("images"), list) else []
    attribute_values = platform_requirements.get("attribute_values") if isinstance(platform_requirements.get("attribute_values"), dict) else {}
    platform_field_gaps = platform_field_gaps_for_requirements(platform_requirements)
    missing_blocking_attrs = platform_field_gaps["blocking"]
    missing_recheck_attrs = platform_field_gaps["recheck"]
    sku_readiness = build_sku_readiness(sku_plan, selling_price, logistics, platform)
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
            "block" if sku_readiness["blocking_gaps"] else ("warning" if sku_readiness["warning_gaps"] else "pass"),
            _sku_readiness_message(sku_readiness),
            sku_readiness,
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
            {
                "blocking_fields": platform_field_gaps["blocking_fields"],
                "recheck_fields": platform_field_gaps["recheck_fields"],
            },
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


def build_sku_readiness(
    sku_plan: dict,
    selling_price: float | None,
    logistics: dict | None,
    platform: str | None = None,
) -> dict:
    """Return platform publish readiness for SKU rows.

    This mirrors the frontend Listing SKU table contract: platform publishing needs
    concrete SKU rows or a single-SKU fallback, positive price, stock, weight and
    package dimensions. TEMU also requires SPU/SKC because its seller workflow
    distinguishes SPU/SKC/SKU.
    """
    platform_code = (platform or "").lower()
    variants = sku_plan.get("variants") if isinstance(sku_plan.get("variants"), list) else []
    active_variants = [variant for variant in variants if isinstance(variant, dict) and variant.get("enabled", True) is not False]
    if not active_variants and sku_plan.get("master_sku"):
        active_variants = [{
            "sku": sku_plan.get("master_sku"),
            "price": selling_price,
            "stock": None,
            "dimensions": {},
            "weight_g": None,
        }]

    blocking_gaps: list[str] = []
    warning_gaps: list[str] = []
    rows: list[dict] = []
    if not active_variants:
        blocking_gaps.append("至少需要一条启用 SKU")

    for index, variant in enumerate(active_variants):
        sku = str(variant.get("sku") or "").strip()
        variation = _sku_variation_label(variant)
        price = _as_positive_number(variant.get("price"))
        stock = _as_non_negative_int(variant.get("stock"))
        weight_g = _as_positive_number(variant.get("weight_g") or (logistics or {}).get("weight_g"))
        dimensions = variant.get("dimensions") if isinstance(variant.get("dimensions"), dict) else {}
        if not dimensions and isinstance((logistics or {}).get("dimensions"), dict):
            dimensions = (logistics or {}).get("dimensions") or {}
        row_blocking: list[str] = []
        row_warnings: list[str] = []
        if not sku:
            row_blocking.append("商家SKU")
        if len(active_variants) > 1 and not variation:
            row_blocking.append("规格属性")
        if price is None:
            row_blocking.append("售价")
        if stock is None:
            row_blocking.append("库存")
        if weight_g is None:
            row_blocking.append("重量")
        missing_dimensions = [
            label for key, label in (
                ("length_cm", "长"),
                ("width_cm", "宽"),
                ("height_cm", "高"),
            )
            if _as_positive_number(dimensions.get(key)) is None
        ]
        if missing_dimensions:
            row_blocking.append("包裹尺寸(" + "/".join(missing_dimensions) + ")")
        if platform_code == "temu" and not str(variant.get("spu_skc") or "").strip():
            row_blocking.append("SPU/SKC")
        if platform_code in {"shopee", "tiktok", "tiktok_shop"} and not str(variant.get("platform_sku") or "").strip():
            row_warnings.append("平台SKU/Model ID")
        if not str(variant.get("sku_image_url") or variant.get("sku_image_role") or "").strip():
            row_warnings.append("SKU图")
        if not str(variant.get("barcode") or "").strip():
            row_warnings.append("条码/货号")
        if row_blocking:
            blocking_gaps.append(f"第{index + 1}条SKU缺少" + "、".join(row_blocking))
        if row_warnings:
            warning_gaps.append(f"第{index + 1}条SKU建议补充" + "、".join(row_warnings))
        rows.append({
            "index": index,
            "sku": sku,
            "variation": variation,
            "blocking": row_blocking,
            "warnings": row_warnings,
        })

    return {
        "platform": platform_code or None,
        "active_sku_count": len(active_variants),
        "blocking_gaps": blocking_gaps,
        "warning_gaps": warning_gaps,
        "rows": rows,
    }


def _sku_variation_label(variant: dict) -> str:
    explicit = str(variant.get("variation") or "").strip()
    if explicit:
        return explicit
    parts = [
        str(variant.get("option_1_value") or "").strip(),
        str(variant.get("option_2_value") or "").strip(),
    ]
    return " / ".join(part for part in parts if part)


def _as_positive_number(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _as_non_negative_int(value) -> int | None:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def _sku_readiness_message(readiness: dict) -> str:
    if readiness["blocking_gaps"]:
        return "SKU发布阻断：" + "；".join(readiness["blocking_gaps"])
    if readiness["warning_gaps"]:
        return "SKU可发布，建议补充：" + "；".join(readiness["warning_gaps"])
    return f"SKU发布准备完成，共 {readiness['active_sku_count']} 条启用 SKU。"


def platform_field_gaps_for_requirements(platform_requirements: dict) -> dict:
    values = platform_requirements.get("attribute_values") if isinstance(platform_requirements.get("attribute_values"), dict) else {}
    field_meta: dict[str, dict] = {}
    field_groups: dict[str, dict] = {}
    for group in platform_requirements.get("field_groups") or []:
        if not isinstance(group, dict):
            continue
        for field in group.get("fields") or []:
            if isinstance(field, dict) and field.get("key"):
                key = str(field["key"])
                field_meta[key] = field
                field_groups[key] = group

    required_keys = set()
    for key in platform_requirements.get("required_attributes") or []:
        if key:
            required_keys.add(str(key))
    for key, field in field_meta.items():
        if field.get("required"):
            required_keys.add(key)

    blocking: list[str] = []
    recheck: list[str] = []
    blocking_fields: list[dict] = []
    recheck_fields: list[dict] = []
    for key in sorted(required_keys):
        if _has_platform_field_value(values.get(key)):
            continue
        field = field_meta.get(key) or {}
        label = field.get("label") or key
        evidence_state = str(field.get("evidence_state") or "")
        if evidence_state.startswith("needs_"):
            recheck.append(label)
            recheck_fields.append(_platform_field_gap_detail(key, field, field_groups.get(key), "recheck"))
        else:
            blocking.append(label)
            blocking_fields.append(_platform_field_gap_detail(key, field, field_groups.get(key), "blocking"))
    return {
        "blocking": blocking,
        "recheck": recheck,
        "blocking_fields": blocking_fields,
        "recheck_fields": recheck_fields,
    }


def _has_platform_field_value(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict, tuple, set)):
        return bool(value)
    return True


def _platform_field_gap_detail(key: str, field: dict, group: dict | None, severity: str) -> dict:
    return {
        "key": key,
        "label": field.get("label") or key,
        "severity": severity,
        "required": True,
        "unified_field_key": field.get("unified_field_key"),
        "standard_label": field.get("standard_label"),
        "data_type": field.get("data_type"),
        "platform_field_name": field.get("platform_field_name"),
        "miaoshou_field_name": field.get("miaoshou_field_name"),
        "country_difference": field.get("country_difference"),
        "evidence_state": field.get("evidence_state"),
        "group_id": group.get("id") if isinstance(group, dict) else None,
        "group_label": group.get("label") if isinstance(group, dict) else None,
    }


def videos_from_attributes(attributes: dict) -> list[str]:
    videos = attributes.get("videos")
    if isinstance(videos, list):
        return [video for video in videos if isinstance(video, str) and video]
    video = attributes.get("video_url")
    return [video] if isinstance(video, str) and video else []


def _validation_check(code: str, label: str, state: str, message: str, details: dict | None = None) -> dict:
    check = {
        "code": code,
        "label": label,
        "state": state,
        "message": message,
    }
    if details:
        check["details"] = details
    return check


def _platform_fields_message(blocking: list[str], recheck: list[str], has_values: bool) -> str:
    parts = []
    if blocking:
        parts.append("仍缺平台已确认必填字段：" + "、".join(blocking))
    if recheck:
        parts.append("待补证字段暂不阻断：" + "、".join(recheck))
    if parts:
        return "；".join(parts)
    return "平台字段已有属性值。" if has_values else "平台字段值待补齐。"

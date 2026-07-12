"""Platform product field schema merge helpers."""

from copy import deepcopy
from typing import Any


def merge_platform_requirements(base: dict | None, platform: str | None, schemas: dict | None) -> dict:
    if not isinstance(base, dict):
        base = {}
    schema = (schemas or {}).get(platform or "")
    if not isinstance(schema, dict):
        return dict(base)
    merged = deepcopy(base)
    merged.setdefault("field_groups", schema.get("groups") or [])
    merged.setdefault("object_model", schema.get("object_model") or [])
    merged.setdefault("evidence_source", schema.get("evidence_source"))
    merged.setdefault("evidence", schema.get("evidence"))
    _merge_category_profile(merged, schema)
    if not isinstance(merged.get("required_attributes"), list):
        merged["required_attributes"] = [
            field.get("key")
            for group in merged.get("field_groups") or []
            for field in group.get("fields") or []
            if field.get("key") and field.get("required")
        ]
    else:
        required = list(merged.get("required_attributes") or [])
        for group in merged.get("field_groups") or []:
            for field in group.get("fields") or []:
                key = field.get("key")
                if key and field.get("required") and key not in required:
                    required.append(key)
        merged["required_attributes"] = required
    merged["attribute_values"] = merged.get("attribute_values") if isinstance(merged.get("attribute_values"), dict) else {}
    return merged


def merge_platform_requirements_map(requirements: dict | None, schemas: dict | None) -> dict:
    if not isinstance(requirements, dict):
        requirements = {}
    platforms = set(requirements.keys()) | set((schemas or {}).keys())
    return {
        platform: merge_platform_requirements(requirements.get(platform), platform, schemas)
        for platform in platforms
    }


def _merge_category_profile(merged: dict[str, Any], schema: dict[str, Any]) -> None:
    profile = _match_category_profile(merged, schema.get("category_profiles"))
    if not profile:
        return

    fields = [field for field in profile.get("fields") or [] if isinstance(field, dict)]
    group_id = f"category_profile_{profile.get('id') or 'matched'}"
    field_groups = list(merged.get("field_groups") or [])
    if not any(group.get("id") == group_id for group in field_groups if isinstance(group, dict)):
        field_groups.append({
            "id": group_id,
            "label": profile.get("label") or "类目差异字段",
            "help": profile.get("help") or "按当前平台类目补充的差异字段。",
            "fields": fields,
        })
    merged["field_groups"] = field_groups
    merged["category_profile"] = {
        "id": profile.get("id"),
        "label": profile.get("label"),
        "matched_category": _category_text(merged),
        "match": profile.get("match") or [],
    }
    merged["category_field_gaps"] = _category_field_gaps(fields)


def _match_category_profile(merged: dict[str, Any], profiles: Any) -> dict[str, Any] | None:
    if not isinstance(profiles, list):
        return None
    category = _category_text(merged).lower()
    if not category:
        return None
    for profile in profiles:
        if not isinstance(profile, dict):
            continue
        matches = profile.get("match") if isinstance(profile.get("match"), list) else []
        if any(str(item).strip().lower() and str(item).strip().lower() in category for item in matches):
            return profile
    return None


def _category_text(merged: dict[str, Any]) -> str:
    values = merged.get("attribute_values") if isinstance(merged.get("attribute_values"), dict) else {}
    for key in ("category", "category_path", "platform_category", "category_id"):
        value = values.get(key) or merged.get(key)
        if value:
            return str(value)
    return ""


def _category_field_gaps(fields: list[dict[str, Any]]) -> dict[str, list[str]]:
    gaps = {
        "needs_category_recheck": [],
        "needs_edit_page_recheck": [],
        "needs_api_recheck": [],
    }
    for field in fields:
        key = field.get("key")
        state = field.get("evidence_state")
        if key and state in gaps:
            gaps[state].append(key)
    return gaps

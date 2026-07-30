"""Listing AI/rule assist helpers for batch publishing drafts."""


async def generate_listing_assist(db, draft: dict) -> dict:
    """Generate an AI/rule candidate patch for a listing draft without saving state."""
    from app.services.task_executor import execute_task

    assist_type = draft.get("assist_type")
    allowed = {"listing_copy", "image_edit_plan", "video_script", "compliance_check"}
    if assist_type not in allowed:
        return {
            "status": "data_required",
            "assist_type": assist_type,
            "patch": {},
            "provider": "",
            "confidence": "low",
            "error": "不支持的 Listing 辅助类型",
            "does_not_save": True,
        }
    preferred_providers = draft.get("preferred_providers") if isinstance(draft.get("preferred_providers"), list) else ["rule_engine"]
    result = await execute_task(db, assist_type, _listing_assist_input(draft), preferred_providers=preferred_providers)
    if not result.success:
        return {
            "status": "data_required",
            "assist_type": assist_type,
            "patch": {},
            "provider": result.provider,
            "confidence": result.confidence,
            "error": result.error or "Listing 辅助生成失败",
            "does_not_save": True,
        }
    text = ((result.data or {}).get("text") or "").strip()
    patch = _listing_assist_patch(assist_type, text, draft)
    return {
        "status": "ready",
        "assist_type": assist_type,
        "patch": patch,
        "candidate_text": text,
        "provider": result.provider,
        "confidence": result.confidence,
        "data_gaps": (result.data or {}).get("data_gaps") or [],
        "does_not_save": True,
        "note": "AI/规则仅返回候选 patch，不自动保存草稿或发布平台。",
    }


def _listing_assist_input(draft: dict) -> dict:
    requirements = draft.get("platform_requirements") if isinstance(draft.get("platform_requirements"), dict) else {}
    logistics = draft.get("logistics") if isinstance(draft.get("logistics"), dict) else {}
    compliance = draft.get("compliance") if isinstance(draft.get("compliance"), dict) else {}
    return {
        "product_name": draft.get("product_name") or draft.get("template_title") or "当前商品",
        "category": draft.get("category") or "",
        "platform": draft.get("platform") or "",
        "market": draft.get("market") or "",
        "features": _assist_features(requirements, logistics, compliance),
        "selling_points": draft.get("template_description") or "",
        "target_audience": draft.get("market_label") or draft.get("market") or "",
        "source_url": draft.get("source_url") or "",
        "current_title": draft.get("template_title") or "",
        "current_description": draft.get("template_description") or "",
        "platform_requirements": requirements,
        "validation_checks": draft.get("validation_checks") or [],
    }


def _assist_features(requirements: dict, logistics: dict, compliance: dict) -> str:
    attribute_values = requirements.get("attribute_values") if isinstance(requirements.get("attribute_values"), dict) else {}
    features = [f"{key}:{value}" for key, value in attribute_values.items() if value]
    if logistics.get("weight_g"):
        features.append(f"重量:{logistics['weight_g']}g")
    if compliance.get("condition"):
        features.append(f"成色:{compliance['condition']}")
    return "；".join(features[:8]) or "核心特性待补充"


def _listing_assist_patch(assist_type: str, text: str, draft: dict) -> dict:
    if assist_type == "listing_copy":
        title = _extract_prefixed_line(text, "标题") or draft.get("template_title") or (draft.get("product_name") or "")[:80]
        description = _extract_prefixed_line(text, "描述") or text
        return {"template_title": title[:500], "template_description": description}
    if assist_type == "video_script":
        media = draft.get("media_assets") if isinstance(draft.get("media_assets"), dict) else {}
        return {"media_assets": {**media, "video_script": text}}
    if assist_type == "image_edit_plan":
        media = draft.get("media_assets") if isinstance(draft.get("media_assets"), dict) else {}
        return {"media_assets": {**media, "image_edit_plan": text}}
    if assist_type == "compliance_check":
        compliance = draft.get("compliance") if isinstance(draft.get("compliance"), dict) else {}
        return {
            "compliance": {
                **compliance,
                "ai_review_note": text,
                "restricted_check_status": compliance.get("restricted_check_status") or "pending_review",
            }
        }
    return {}


def _extract_prefixed_line(text: str, prefix: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(f"{prefix}：") or stripped.startswith(f"{prefix}:"):
            return stripped.split("：", 1)[-1].split(":", 1)[-1].strip()
    return ""

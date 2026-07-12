"""AI task capability matrix."""

from app.services.provider_service import list_providers


AI_TASK_TYPES = {
    "listing_copy": {
        "label": "Listing 文案",
        "required_capabilities": ["text"],
        "requires_local_tool": False,
        "output_contract": "标题、卖点、描述候选版本",
    },
    "decision_analysis": {
        "label": "选品决策分析",
        "required_capabilities": ["text", "analysis"],
        "requires_local_tool": False,
        "output_contract": "结构化机会、风险和补证据建议",
    },
    "image_understanding": {
        "label": "图片理解",
        "required_capabilities": ["vision", "text"],
        "requires_local_tool": False,
        "output_contract": "图片主体、材质、风格和合规风险",
    },
    "image_edit_plan": {
        "label": "图片处理建议",
        "required_capabilities": ["vision", "text"],
        "requires_local_tool": True,
        "output_contract": "可执行图片处理步骤，不直接伪造处理成功",
    },
    "video_script": {
        "label": "视频脚本",
        "required_capabilities": ["text"],
        "requires_local_tool": False,
        "output_contract": "短视频镜头脚本、字幕和素材清单",
    },
    "pricing_explanation": {
        "label": "定价解释",
        "required_capabilities": ["text", "analysis"],
        "requires_local_tool": False,
        "output_contract": "定价依据、价格带和风险解释",
    },
    "risk_summary": {
        "label": "风险摘要",
        "required_capabilities": ["text", "analysis"],
        "requires_local_tool": False,
        "output_contract": "风险等级、影响对象、证据和处理建议",
    },
}


async def get_ai_task_matrix(db, user_id: str | None = None) -> dict:
    providers = await list_providers(db, user_id)
    return build_ai_task_matrix(providers)


def build_ai_task_matrix(providers: list[dict]) -> dict:
    provider_options = sorted(providers, key=lambda item: item.get("user_priority") or item.get("priority") or 999)
    tasks = [_task_entry(task_type, definition, provider_options) for task_type, definition in AI_TASK_TYPES.items()]
    return {
        "status": "ready" if any(task["status"] == "ready" for task in tasks) else "configuration_required",
        "tasks": tasks,
        "data_gaps": sorted({gap for task in tasks for gap in task["data_gaps"]}),
    }


def _task_entry(task_type: str, definition: dict, providers: list[dict]) -> dict:
    options = [_provider_option(provider, definition) for provider in providers]
    usable = [option for option in options if option["usable"]]
    gaps = []
    if not providers:
        gaps.append("ai_providers")
    if definition.get("requires_local_tool") and not usable:
        gaps.append("local_tool")
    if not usable:
        gaps.append(f"ai_task.{task_type}.provider")
    return {
        "task_type": task_type,
        "label": definition["label"],
        "required_capabilities": definition["required_capabilities"],
        "requires_local_tool": definition["requires_local_tool"],
        "output_contract": definition["output_contract"],
        "status": "ready" if usable else "configuration_required",
        "provider_options": options,
        "data_gaps": gaps,
    }


def _provider_option(provider: dict, definition: dict) -> dict:
    capabilities = provider.get("capabilities") or []
    missing = [capability for capability in definition["required_capabilities"] if capability not in capabilities]
    if definition.get("requires_local_tool") and provider.get("type") not in ("cli", "local_tool"):
        missing.append("local_tool")
    enabled = provider.get("user_enabled", provider.get("enabled", True))
    available = bool(provider.get("available")) and bool(enabled)
    return {
        "provider_id": provider.get("id"),
        "provider_name": provider.get("name"),
        "provider_type": provider.get("type"),
        "priority": provider.get("user_priority") or provider.get("priority"),
        "available": available,
        "usable": available and not missing,
        "missing_capabilities": missing,
        "needs_key": provider.get("needs_key"),
        "needs_overseas": provider.get("needs_overseas", False),
    }

"""Content factory workbench projections bound to concrete products."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.sourcing_item import SourcingItem
from app.services import config_service
from app.services.business_work_item_service import enrich_work_item_state
from app.services.evidence_service import source_ref
from app.services.media_readiness_service import media_readiness_from_extra
from app.services.platform_product_field_service import merge_platform_requirements

CONTENT_READY_STAGES = ("decision_passed", "content_required", "content_ready", "pricing_required")
CONTENT_TASKS = (
    {"task_type": "listing_copy", "label": "Listing 标题文案", "requires_ai": True, "required_for_pricing": True},
    {"task_type": "selling_points", "label": "卖点提炼", "requires_ai": True, "required_for_pricing": True},
    {"task_type": "description", "label": "商品描述", "requires_ai": True, "required_for_pricing": True},
    {"task_type": "image_understanding", "label": "图片理解", "requires_ai": True, "required_for_pricing": True},
    {"task_type": "image_edit_plan", "label": "图片处理建议", "requires_ai": True, "required_for_pricing": True},
    {"task_type": "video_script", "label": "视频脚本", "requires_ai": True, "required_for_pricing": False},
    {"task_type": "compliance_check", "label": "合规检查", "requires_ai": True, "required_for_pricing": True},
    {"task_type": "listing_store_override", "label": "店铺 Listing 覆盖字段包", "requires_ai": False, "required_for_pricing": False},
    {"task_type": "enhanced_content", "label": "A+图文增强内容", "requires_ai": True, "required_for_pricing": False},
    {"task_type": "ad_creative", "label": "广告素材脚本", "requires_ai": True, "required_for_pricing": False},
    {"task_type": "influencer_brief", "label": "达人合作 Brief", "requires_ai": True, "required_for_pricing": False},
)
REQUIRED_CONTENT_GAPS = (
    ("listing_copy", "缺少已确认标题文案"),
    ("selling_points", "缺少已确认卖点描述"),
    ("description", "缺少已确认商品描述"),
    ("image_understanding", "缺少已确认图片理解"),
    ("image_edit_plan", "缺少已确认图片处理建议"),
    ("compliance_check", "缺少已确认合规检查"),
)


async def get_content_workbench(db: AsyncSession, user_id: str) -> dict:
    """Return products that are allowed to enter listing-content production."""
    result = await db.execute(
        select(SourcingItem)
        .where(
            SourcingItem.user_id == user_id,
            SourcingItem.is_active == True,  # noqa: E712
            SourcingItem.pipeline_stage.in_(CONTENT_READY_STAGES),
        )
        .order_by(desc(SourcingItem.updated_at))
        .limit(30)
    )
    field_schemas = await config_service.get_platform_product_field_groups(db)
    items = [_content_work_item(item, field_schemas) for item in result.scalars().all()]
    return {
        "status": "ready" if items else "data_required",
        "metrics": {
            "total": len(items),
            "not_started": sum(1 for item in items if item["content_status"] == "not_started"),
            "in_progress": sum(1 for item in items if item["content_status"] == "in_progress"),
            "ready": sum(1 for item in items if item["content_status"] == "ready"),
        },
        "items": items,
        "data_gaps": [] if items else ["暂无已通过选品决策的商品"],
        "evidence_window": "当前已通过选品决策的商品快照",
        "confidence_reason": "内容工厂队列仅读取已进入内容制作阶段的真实选品商品。",
    }


async def get_content_task_matrix(db: AsyncSession, user_id: str, item_id: str) -> dict:
    item = await _get_content_item(db, user_id, item_id)
    tasks = _task_matrix(item)
    return {
        "work_item_id": f"sourcing_item:{item.id}",
        "product_name": item.product_name,
        "target_platform": item.platform,
        "target_market": item.market,
        "metrics": {
            "total": len(tasks),
            "confirmed": sum(1 for task in tasks if task["status"] == "confirmed"),
            "draft_ready": sum(1 for task in tasks if task["status"] == "draft_ready"),
            "unconfirmed": sum(1 for task in tasks if task["status"] != "confirmed"),
            "required_total": sum(1 for task in tasks if task["required_for_pricing"]),
            "required_confirmed": sum(1 for task in tasks if task["required_for_pricing"] and task["status"] == "confirmed"),
        },
        "tasks": tasks,
        "evidence_window": "当前商品内容任务版本",
        "confidence_reason": "任务版本来自当前商品的内容工厂人工确认记录，不自动冒充平台可用 Listing。",
        "source_refs": [source_ref("sourcing_item", item.id, label=item.product_name, meta={"route": "/content"})],
        "next_action": "进入定价校验" if not _content_gaps(item) else "继续确认内容任务",
        "next_action_route": "/pricing" if not _content_gaps(item) else "/content",
    }


async def save_content_task_version(
    db: AsyncSession,
    user_id: str,
    item_id: str,
    task_type: str,
    content: str,
    *,
    provider: str = "manual",
) -> dict:
    if task_type not in {task["task_type"] for task in CONTENT_TASKS}:
        raise HTTPException(status_code=400, detail="未知内容任务类型")
    item = await _get_content_item(db, user_id, item_id)
    tasks = _stored_tasks(item)
    record = tasks.setdefault(task_type, {"versions": [], "confirmed_version": None})
    version = len(record["versions"]) + 1
    record["versions"].append({
        "version": version,
        "content": content,
        "provider": provider,
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _set_stored_tasks(item, tasks)
    await db.commit()
    return {"task_type": task_type, "version": version}


async def confirm_content_task_version(
    db: AsyncSession,
    user_id: str,
    item_id: str,
    task_type: str,
    version: int,
) -> dict:
    item = await _get_content_item(db, user_id, item_id)
    tasks = _stored_tasks(item)
    record = tasks.get(task_type)
    if not record or not any(item["version"] == version for item in record.get("versions", [])):
        raise HTTPException(status_code=404, detail="内容任务版本不存在")
    record["confirmed_version"] = version
    for item_version in record.get("versions", []):
        item_version["status"] = "confirmed" if item_version["version"] == version else "draft"
    _set_stored_tasks(item, tasks)
    _advance_after_content_confirmation(item)
    await db.commit()
    return await get_content_task_matrix(db, user_id, item_id)


def _content_work_item(item: SourcingItem, field_schemas: dict | None = None) -> dict:
    content_gaps = _content_gaps(item)
    content_status = _content_status(item, content_gaps)
    payload = enrich_work_item_state({
        "id": item.id,
        "type": "sourcing_item",
        "name": item.product_name,
        "stage_key": "content",
        "status": "ready" if content_status == "ready" else "data_required",
        "gaps": content_gaps,
        "data_gaps": content_gaps,
        "source_refs": [source_ref("sourcing_item", item.id, label=item.product_name, meta={"route": "/content"})],
        "platform": item.platform,
        "market": item.market,
        "signal": _signal(item),
    })
    return {
        **payload,
        "product_name": item.product_name,
        "category": item.category,
        "target_platform": item.platform,
        "target_market": item.market,
        "image_url": item.source_image,
        "media_readiness": media_readiness_from_extra(item.extra_data or {}, item.source_image),
        "platform_requirements": _platform_requirements(item, field_schemas),
        "content_brief": _content_brief(item),
        "source_price_rmb": item.source_price_rmb,
        "selling_price_local": item.selling_price_local,
        "profit_margin_pct": item.profit_margin_pct,
        "content_status": content_status,
        "content_gaps": content_gaps,
        "next_action": "制作标题、卖点、图片和视频素材" if content_gaps else "进入定价校验",
        "next_action_route": "/content",
    }


async def _get_content_item(db: AsyncSession, user_id: str, item_id: str) -> SourcingItem:
    result = await db.execute(
        select(SourcingItem).where(
            SourcingItem.id == item_id,
            SourcingItem.user_id == user_id,
            SourcingItem.is_active == True,  # noqa: E712
        )
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="内容商品不存在")
    if item.pipeline_stage not in CONTENT_READY_STAGES:
        raise HTTPException(status_code=409, detail="商品尚未通过选品决策，不能进入内容制作")
    return item


def _task_matrix(item: SourcingItem) -> list[dict]:
    stored_tasks = _stored_tasks(item)
    rows = []
    for definition in CONTENT_TASKS:
        record = stored_tasks.get(definition["task_type"], {})
        versions = record.get("versions") or []
        confirmed_version = record.get("confirmed_version")
        latest_version = versions[-1] if versions else None
        status = "confirmed" if confirmed_version else "draft_ready" if versions else "not_started"
        rows.append({
            **definition,
            "status": status,
            "version_count": len(versions),
            "confirmed_version": confirmed_version,
            "latest_version": latest_version,
            "confirmation_required": status != "confirmed",
        })
    return rows


def _stored_tasks(item: SourcingItem) -> dict:
    extra = item.extra_data or {}
    stored = extra.get("content_tasks") or {}
    return stored if isinstance(stored, dict) else {}


def _platform_requirements(item: SourcingItem, field_schemas: dict | None = None) -> dict:
    requirements = (item.extra_data or {}).get("platform_requirements") or {}
    if not isinstance(requirements, dict):
        return {}
    platform_requirements = requirements.get(item.platform) or {}
    return merge_platform_requirements(platform_requirements, item.platform, field_schemas)


def _content_brief(item: SourcingItem) -> dict:
    brief = (item.extra_data or {}).get("content_workbench") or {}
    if not isinstance(brief, dict):
        brief = {}
    stored_tasks = _stored_tasks(item)
    listing_title = _confirmed_task_content(stored_tasks, "listing_copy")
    selling_points = _confirmed_task_content(stored_tasks, "selling_points")
    description = _confirmed_task_content(stored_tasks, "description")
    return {
        **brief,
        "title": listing_title or brief.get("title"),
        "bullets": _lines(selling_points) or brief.get("bullets") or _lines(description)[:5],
        "description": description or brief.get("description"),
        "video_script": _confirmed_task_content(stored_tasks, "video_script") or brief.get("video_script"),
    }


def _set_stored_tasks(item: SourcingItem, tasks: dict) -> None:
    extra = dict(item.extra_data or {})
    extra["content_tasks"] = tasks
    item.extra_data = extra
    flag_modified(item, "extra_data")


def _confirmed_task_content(tasks: dict, task_type: str) -> str:
    record = tasks.get(task_type) or {}
    confirmed_version = record.get("confirmed_version")
    if not confirmed_version:
        return ""
    for version in record.get("versions") or []:
        if version.get("version") == confirmed_version:
            return str(version.get("content") or "")
    return ""


def _lines(value: str) -> list[str]:
    return [line.strip(" -•\t") for line in str(value or "").splitlines() if line.strip()]


def _advance_after_content_confirmation(item: SourcingItem) -> None:
    if _content_gaps(item):
        return
    if item.pipeline_stage in ("decision_passed", "content_required", "content_ready"):
        item.pipeline_stage = "pricing_required"


def _content_gaps(item: SourcingItem) -> list[str]:
    stored_tasks = _stored_tasks(item)
    gaps = [
        label
        for task_type, label in REQUIRED_CONTENT_GAPS
        if not stored_tasks.get(task_type, {}).get("confirmed_version")
    ]
    if not item.platform:
        gaps.append("缺少目标平台")
    if not item.market:
        gaps.append("缺少目标市场")
    return gaps


def _content_status(item: SourcingItem, content_gaps: list[str]) -> str:
    if not content_gaps:
        return "ready"
    tasks = _task_matrix(item)
    if any(task["status"] == "confirmed" or task["version_count"] > 0 for task in tasks):
        return "in_progress"
    return "not_started"


def _signal(item: SourcingItem) -> str:
    parts = [f"阶段 {item.pipeline_stage}"]
    if item.source_price_rmb is not None:
        parts.append(f"采购价 ¥{item.source_price_rmb}")
    if item.profit_margin_pct is not None:
        parts.append(f"利润率 {item.profit_margin_pct}%")
    return " · ".join(parts)

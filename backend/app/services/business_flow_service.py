"""Business-flow projection for the V2 product lifecycle module."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.business_flow_item_service import get_flow_items
from app.services.business_flow_projection_service import build_business_flow_projections
from app.services.business_flow_task_service import list_flow_tasks, merge_task_into_item
from app.services.business_work_item_service import enrich_work_item_state
from app.services.cockpit_service import get_operating_cockpit


STAGES = [
    ("selection", "选品", "/scout", "读取选品列表、趋势发现和智能雷达"),
    ("sourcing", "供应链/采购", "/scout/sources", "读取品源管理、供应商与 1688 采集记录"),
    ("content", "标题与素材", "/content", "读取标题、图片处理和视频生成能力"),
    ("listing", "平台上架", "/publish", "读取批量刊登、Listing模板和平台规则校验"),
    ("fulfillment", "订单履约", "/orders", "读取订单管道、物流跟踪和售后异常"),
    ("optimization", "运营优化", "/growth", "读取运营台账、增长引擎和AI建议"),
]

MODEL_DEFINITION = {
    "stage_model": "operating_lifecycle_6",
    "stage_count": 6,
    "description": "当前六阶段是经营全链路落地模型，覆盖从选品到运营优化的端到端业务推进。",
    "design_alignment": "功能设计中的七阶段属于业务链路深化参考；当前落地版将成本测算并入供应链/采购，将销售测品并入订单履约，将销售评估并入运营优化，避免与选品子流程重复建模。",
    "selection_subflow": "信号捕获 → 候选验证 → 选品决策 → 内容制作 → 定价校验 → 平台刊登",
    "object_state_contract": "统一业务对象状态：每个商品级节点必须返回 work_item_id、lifecycle_status、lifecycle_label、object_refs、evidence_completeness 和 evidence_summary。",
    "stage_mapping": {
        "量化选品": "选品",
        "成本测算": "供应链/采购",
        "平台上品": "平台上架",
        "销售测品": "订单履约",
        "履约采购": "订单履约",
        "运营优化": "运营优化",
        "销售评估": "运营优化",
    },
}


async def get_business_flow_overview(db: AsyncSession, user_id: str, current_user: User | None = None) -> dict:
    cockpit = await get_operating_cockpit(db, user_id)
    raw_items = await get_flow_items(db, user_id)
    task_map = await list_flow_tasks(db, user_id)
    raw_keys = {(item["type"], item["id"]) for item in raw_items}
    raw_items.extend(_task_only_item(task) for key, task in task_map.items() if key not in raw_keys)
    current_user_id = current_user.id if current_user else user_id
    current_username = current_user.username if current_user else None
    items = [
        merge_task_into_item(item, task_map.get((item["type"], item["id"])), current_user_id)
        for item in raw_items
    ]
    stages = [_stage_projection(key, name, route, source, cockpit, items) for key, name, route, source in STAGES]
    source_refs = _unique_refs([ref for item in stages + items for ref in item["source_refs"]])
    data_gaps = [gap for item in stages for gap in item["data_gaps"]]
    projections = build_business_flow_projections(stages, items)
    return {
        "generated_at": cockpit["generated_at"],
        "current_username": current_username,
        "stages": stages,
        "items": items,
        **projections,
        "model_definition": MODEL_DEFINITION,
        "metrics": {
            "stage_count": len(stages),
            "blocked": sum(1 for item in stages if item["status"] == "blocked"),
            "data_required": sum(1 for item in stages if item["status"] == "data_required"),
            "source_count": len(source_refs),
            "item_count": len(items),
            "item_blocked": sum(1 for item in items if item["status"] == "blocked"),
            "item_data_required": sum(1 for item in items if item["status"] == "data_required"),
            "task_count": sum(1 for item in items if item["task_id"]),
            "assigned_to_me": sum(1 for item in items if current_username and item["assigned_to"] == current_username),
            "followed": sum(1 for item in items if item["is_followed"]),
            "exceptions": sum(1 for item in items if item["status"] == "blocked"),
        },
        "source_refs": source_refs,
        "evidence_window": cockpit["evidence_window"],
        "confidence_reason": "业务链路由经营指挥台区块和商品级流水项投影生成，不脱离真实业务记录。",
        "data_gaps": data_gaps,
        "gaps": data_gaps,
    }


def _stage_projection(key: str, name: str, route: str, source: str, cockpit: dict, items: list[dict]) -> dict:
    sections = cockpit["sections"]
    mapping = {
        "listing": (sections["inventory"], "平台 Listing 状态"),
        "fulfillment": (sections["orders"], "真实订单"),
        "optimization": (sections["ai_suggestions"], "运营建议"),
    }
    stage_items = [item for item in items if item["stage_key"] == key]
    if key in ("selection", "sourcing"):
        section = {
            "source_refs": _unique_refs([ref for item in stage_items for ref in item["source_refs"]]),
            "evidence_window": "当前数据库快照",
            "gaps": list(dict.fromkeys(gap for item in stage_items for gap in item["gaps"])),
        }
        signal_name = "选品候选记录" if key == "selection" else "真实货源记录"
        if not stage_items:
            section["gaps"] = ["尚无选品候选记录" if key == "selection" else "尚无真实货源记录"]
    elif key == "content":
        section = {
            "source_refs": [],
            "evidence_window": "当前数据库快照",
            "gaps": ["业务链路尚未关联内容资产记录"],
        }
        signal_name = "内容资产记录"
    else:
        section, signal_name = mapping[key]
    gaps = list(section["gaps"])
    if key == "listing":
        gaps.extend(sections["inventory"]["gaps"])
    if key == "optimization" and sections["reports"]["metrics"]["anomaly_count"] > 0:
        gaps.append("存在报表异常，需先完成风险复核")
    return {
        "key": key,
        "name": name,
        "route": route,
        "next_action_route": route,
        "source": source,
        "status": _stage_status(key, cockpit, gaps),
        "signal": _stage_signal(key, cockpit, signal_name, len(stage_items)),
        "data_gaps": gaps,
        "gaps": gaps,
        "next_action": _next_action(key, gaps),
        "source_refs": section["source_refs"],
        "evidence_window": section["evidence_window"],
        "confidence_reason": f"{name}节点读取{signal_name}形成阶段状态。",
    }


def _task_only_item(task) -> dict:
    gaps = [task.last_gap] if task.last_gap else []
    payload = {
        "id": task.item_id,
        "type": task.item_type,
        "name": task.title,
        "stage_key": task.stage_key,
        "stage_name": _stage_name(task.stage_key),
        "status": "blocked" if gaps else "ready",
        "route": task.route,
        "next_action_route": task.route,
        "source": "业务任务池",
        "signal": task.last_gap or "人工创建的业务任务",
        "next_action": "处理业务任务" if gaps else "查看任务复盘",
        "data_gaps": gaps,
        "gaps": gaps,
        "source_refs": task.source_refs or [],
        "evidence_window": "任务审计记录",
        "confidence_reason": "该节点来自业务任务池，保留风险/缺口生成任务后的可见性。",
        "platform": None,
        "market": None,
    }
    return enrich_work_item_state(payload)


def _stage_name(stage_key: str) -> str:
    for key, name, _, _ in STAGES:
        if key == stage_key:
            return name
    return stage_key


def _stage_signal(key: str, cockpit: dict, fallback: str, item_count: int) -> str:
    sections = cockpit["sections"]
    if key == "fulfillment":
        return f"{sections['orders']['metrics']['order_count']} 单真实订单"
    if key == "listing":
        return f"{sections['inventory']['metrics']['active_listings']} 个在售 Listing"
    if key == "optimization":
        return f"{sections['ai_suggestions']['metrics']['active']} 条 AI 建议"
    if key in ("selection", "sourcing"):
        return f"{item_count} 条{fallback}"
    if key == "content":
        return "0 条已关联内容资产"
    return fallback


def _stage_status(key: str, cockpit: dict, gaps: list[str]) -> str:
    if gaps and all(_is_missing_start_gap(gap) for gap in gaps):
        return "data_required"
    if key in ("fulfillment", "listing") and gaps:
        return "blocked"
    if key == "optimization" and cockpit["attention_count"] > 0:
        return "blocked"
    if gaps:
        return "data_required"
    return "ready"


def _next_action(key: str, gaps: list[str]) -> str:
    if gaps:
        return _gap_action(key, gaps[0])
    actions = {
        "selection": "进入选品列表继续验证",
        "sourcing": "复核供应链采购与供应商",
        "content": "生成或复核标题、图片、视频",
        "listing": "进入批量刊登和平台校验",
        "fulfillment": "处理订单履约与售后",
        "optimization": "查看运营建议和增长机会",
    }
    return actions[key]


def _gap_action(key: str, gap: str) -> str:
    if "尚无选品候选" in gap:
        return "前往趋势与候选创建选品记录"
    if "尚无真实货源" in gap or "采购价" in gap or "货源链接" in gap:
        return "前往品源管理补齐货源与成本"
    if "内容资产" in gap:
        return "前往内容工厂生成标题与素材"
    if "Listing" in gap or "上架" in gap or "图片" in gap:
        return "前往批量刊登完成平台校验"
    if "订单" in gap or "履约" in gap or "支付" in gap:
        return "前往订单履约处理异常"
    if "AI" in gap or "报表异常" in gap:
        return "前往运营增长复核建议"
    actions = {
        "selection": "进入选品列表补齐证据",
        "sourcing": "进入品源管理补齐证据",
        "content": "进入内容工厂补齐素材",
        "listing": "进入刊登模块处理阻塞",
        "fulfillment": "进入订单履约处理阻塞",
        "optimization": "进入运营增长处理阻塞",
    }
    return actions[key]


def _is_missing_start_gap(gap: str) -> bool:
    return any(token in gap for token in ("尚无", "没有已确认库存", "当前没有可展示", "近30天没有"))


def _unique_refs(refs: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for ref in refs:
        key = (ref.get("type"), ref.get("id"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(ref)
    return unique

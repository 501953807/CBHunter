"""Command-bus projections for the V2 business monitor."""


def build_business_flow_projections(stages: list[dict], items: list[dict]) -> dict:
    stage_health = [_stage_health(stage, items) for stage in stages]
    product_pipeline = [_pipeline_lane(stage, items) for stage in stages]
    pending_queue = _pending_queue(items)
    current_context = _current_context(pending_queue, product_pipeline)
    return {
        "stage_health": stage_health,
        "product_pipeline": product_pipeline,
        "pending_queue": pending_queue,
        "current_context": current_context,
        "next_actions": _next_actions(current_context, pending_queue, stages),
    }


def _stage_health(stage: dict, items: list[dict]) -> dict:
    stage_items = _stage_items(stage["key"], items)
    object_count = len(stage_items)
    blocked_count = sum(1 for item in stage_items if item["status"] == "blocked")
    data_required_count = sum(1 for item in stage_items if item["status"] == "data_required")
    ready_count = sum(1 for item in stage_items if item["status"] == "ready")
    return {
        "stage_key": stage["key"],
        "label": stage["name"],
        "status": _health_status(stage, object_count, blocked_count, data_required_count),
        "object_count": object_count,
        "blocked_count": blocked_count,
        "data_required_count": data_required_count,
        "ready_count": ready_count,
        "health_pct": round((ready_count / object_count) * 100) if object_count else 0,
        "route": stage["route"],
        "next_action_route": stage["next_action_route"],
        "next_action": stage["next_action"],
        "data_gaps": _unique_text([*(stage.get("gaps") or []), *[gap for item in stage_items for gap in item["gaps"]]]),
        "source_refs": stage.get("source_refs", []),
    }


def _pipeline_lane(stage: dict, items: list[dict]) -> dict:
    stage_items = _stage_items(stage["key"], items)
    return {
        "stage_key": stage["key"],
        "label": stage["name"],
        "status": stage["status"],
        "object_count": len(stage_items),
        "blocked_count": sum(1 for item in stage_items if item["status"] == "blocked"),
        "data_required_count": sum(1 for item in stage_items if item["status"] == "data_required"),
        "route": stage["route"],
        "items": [_queue_item(item) for item in stage_items[:6]],
    }


def _pending_queue(items: list[dict]) -> list[dict]:
    pending = [
        _queue_item(item)
        for item in items
        if item["status"] != "ready" or item.get("task_status") in ("open", "processing")
    ]
    return sorted(pending, key=_pending_sort_key)


def _current_context(pending_queue: list[dict], product_pipeline: list[dict]) -> dict | None:
    if pending_queue:
        return pending_queue[0]
    for lane in product_pipeline:
        if lane["items"]:
            return lane["items"][0]
    return None


def _next_actions(current_context: dict | None, pending_queue: list[dict], stages: list[dict]) -> list[dict]:
    actions = []
    if current_context:
        actions.append(_item_action(current_context, primary=True))
    for item in pending_queue:
        if current_context and item["work_item_id"] == current_context["work_item_id"]:
            continue
        actions.append(_item_action(item, primary=False))
        if len(actions) >= 6:
            return actions
    for stage in stages:
        if not stage.get("gaps"):
            continue
        actions.append({
            "type": "stage",
            "label": stage["next_action"],
            "route": stage["next_action_route"],
            "stage_key": stage["key"],
            "stage_label": stage["name"],
            "reason": stage["gaps"][0],
            "primary": False,
            "work_item_id": None,
        })
        if len(actions) >= 6:
            break
    return actions


def _item_action(item: dict, primary: bool) -> dict:
    return {
        "type": "work_item",
        "label": item["next_action"],
        "route": item["next_action_route"],
        "stage_key": item["stage_key"],
        "stage_label": item["stage_name"],
        "reason": item["gaps"][0] if item["gaps"] else item["signal"],
        "primary": primary,
        "work_item_id": item["work_item_id"],
        "object_refs": item["object_refs"],
    }


def _queue_item(item: dict) -> dict:
    return {
        "id": item["id"],
        "type": item["type"],
        "name": item["name"],
        "work_item_id": item["work_item_id"],
        "object_refs": item["object_refs"],
        "lifecycle_status": item["lifecycle_status"],
        "lifecycle_label": item["lifecycle_label"],
        "evidence_summary": item["evidence_summary"],
        "evidence_completeness": item["evidence_completeness"],
        "stage_key": item["stage_key"],
        "stage_name": item["stage_name"],
        "status": item["status"],
        "route": item["route"],
        "next_action_route": item["next_action_route"],
        "source": item["source"],
        "signal": item["signal"],
        "next_action": item["next_action"],
        "gaps": item["gaps"],
        "source_refs": item["source_refs"],
        "platform": item["platform"],
        "market": item["market"],
        "platform_account_id": item.get("platform_account_id"),
        "account_name": item.get("account_name"),
        "task_id": item["task_id"],
        "task_status": item["task_status"],
        "assigned_to": item["assigned_to"],
        "is_followed": item["is_followed"],
        "priority": item["priority"],
    }


def _stage_items(stage_key: str, items: list[dict]) -> list[dict]:
    return [item for item in items if item["stage_key"] == stage_key]


def _health_status(stage: dict, object_count: int, blocked_count: int, data_required_count: int) -> str:
    if blocked_count > 0 or stage["status"] == "blocked":
        return "blocked"
    if object_count == 0 or data_required_count > 0 or stage["status"] == "data_required":
        return "data_required"
    return "ready"


def _pending_sort_key(item: dict) -> tuple[int, int, str]:
    status_score = 0 if item["status"] == "blocked" else 1 if item["status"] == "data_required" else 2
    priority_score = {"urgent": 0, "high": 1, "normal": 2, "low": 3, None: 4}.get(item.get("priority"), 4)
    return (status_score, priority_score, item["name"])


def _unique_text(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))

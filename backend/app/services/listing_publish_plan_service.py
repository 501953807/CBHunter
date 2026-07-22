"""Local listing publish plan helpers."""


def build_local_publish_plan(plan_data: dict | None) -> tuple[dict | None, list[str]]:
    data = plan_data or {}
    mode = data.get("mode") or "immediate"
    if mode not in ("draft_only", "immediate", "scheduled"):
        return None, ["listing_publish_plan.mode"]
    scheduled_at = data.get("scheduled_at")
    if mode == "scheduled" and not scheduled_at:
        return None, ["listing_publish_plan.scheduled_at"]
    status = "saved_draft" if mode == "draft_only" else "planned"
    return {
        "mode": mode,
        "scheduled_at": scheduled_at if mode == "scheduled" else None,
        "status": status,
        "platform_publish_status": "not_attempted",
        "platform_api_status": "not_connected",
        "note": "当前仅保存本地 Listing 草稿；平台 Open API 未接通，不执行真实发布。" if mode == "draft_only" else "当前仅保存本地发布计划；平台 Open API 未接通，不执行真实发布。",
    }, []

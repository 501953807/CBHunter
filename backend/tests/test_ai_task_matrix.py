"""AI task capability matrix regression tests."""

from app.services.ai_task_matrix_service import AI_TASK_TYPES, build_ai_task_matrix
from app.api.v1.settings import get_provider_task_matrix
from types import SimpleNamespace


def test_ai_task_matrix_defines_required_business_tasks():
    matrix = build_ai_task_matrix([])
    task_codes = {task["task_type"] for task in matrix["tasks"]}

    assert task_codes == {
        "listing_copy",
        "decision_analysis",
        "image_understanding",
        "image_edit_plan",
        "video_script",
        "pricing_explanation",
        "risk_summary",
    }
    assert AI_TASK_TYPES["image_edit_plan"]["requires_local_tool"] is True
    assert AI_TASK_TYPES["image_understanding"]["required_capabilities"] == ["vision", "text"]


def test_ai_task_matrix_marks_provider_unavailable_when_capability_missing():
    providers = [
        {
            "id": "text_api",
            "name": "Text API",
            "type": "free_api",
            "capabilities": ["text", "analysis"],
            "available": True,
            "enabled": True,
            "needs_key": "text_api_key",
            "priority": 10,
        },
        {
            "id": "vision_api",
            "name": "Vision API",
            "type": "paid_api",
            "capabilities": ["vision", "text", "analysis"],
            "available": True,
            "enabled": True,
            "priority": 20,
        },
        {
            "id": "rule_engine",
            "name": "规则引擎",
            "type": "rule",
            "capabilities": ["text"],
            "available": True,
            "enabled": True,
            "priority": 999,
        },
    ]

    matrix = build_ai_task_matrix(providers)
    tasks = {task["task_type"]: task for task in matrix["tasks"]}

    listing_copy = tasks["listing_copy"]
    assert listing_copy["status"] == "ready"
    assert listing_copy["provider_options"][0]["provider_id"] == "text_api"

    image_understanding = tasks["image_understanding"]
    text_option = next(item for item in image_understanding["provider_options"] if item["provider_id"] == "text_api")
    assert text_option["usable"] is False
    assert "vision" in text_option["missing_capabilities"]
    assert image_understanding["status"] == "ready"

    image_edit_plan = tasks["image_edit_plan"]
    assert image_edit_plan["status"] == "configuration_required"
    assert "local_tool" in image_edit_plan["data_gaps"]
    assert all(not option["usable"] for option in image_edit_plan["provider_options"])


def test_settings_provider_task_matrix_api_returns_evidence(monkeypatch):
    async def fake_matrix(_db, user_id):
        assert user_id == "user-a"
        return {
            "status": "configuration_required",
            "tasks": [{"task_type": "image_edit_plan", "data_gaps": ["local_tool"]}],
            "data_gaps": ["local_tool"],
        }

    monkeypatch.setattr("app.api.v1.settings.get_ai_task_matrix", fake_matrix)

    async def run_test():
        response = await get_provider_task_matrix(
            current_user=SimpleNamespace(id="user-a"),
            db=SimpleNamespace(),
        )
        assert response.status == "configuration_required"
        assert response.data["tasks"][0]["task_type"] == "image_edit_plan"
        assert response.data_gaps == ["local_tool"]
        assert response.evidence_window == "当前 AI Provider 能力与任务矩阵"

    import asyncio
    asyncio.run(run_test())

"""Tests for truthful AI provider response handling."""

import asyncio

from app.services.ai_provider_callers import _api_text_result
from app.services.ai_provider_callers import call_rule_engine
from app.services.task_executor import _provider_matches_capabilities, TASK_CAPABILITIES, execute_task


def test_api_error_response_is_not_reported_as_success():
    result = _api_text_result("provider", 401, {"error": "invalid key"}, "")

    assert result["success"] is False
    assert "HTTP 401" in result["error"]


def test_empty_api_text_is_not_reported_as_success():
    result = _api_text_result("provider", 200, {}, " ")

    assert result["success"] is False


def test_valid_api_text_is_reported_with_provider():
    result = _api_text_result("provider", 200, {}, "result")

    assert result == {
        "success": True,
        "data": {"text": "result", "provider": "provider"},
    }


def test_provider_capability_match_requires_all_capabilities():
    provider = {"capabilities": ["text", "analysis"]}

    assert _provider_matches_capabilities(provider, ["text", "analysis"]) is True
    assert _provider_matches_capabilities(provider, ["vision", "text"]) is False


def test_task_executor_knows_planned_ai_task_capabilities():
    assert TASK_CAPABILITIES["listing_copy"] == ["text"]
    assert TASK_CAPABILITIES["image_understanding"] == ["vision", "text"]
    assert TASK_CAPABILITIES["image_edit_plan"] == ["vision", "text"]
    assert TASK_CAPABILITIES["pricing_explanation"] == ["text", "analysis"]


def test_rule_engine_video_script_returns_low_confidence_candidate():
    result = asyncio.run(call_rule_engine("video_script", {
        "product_name": "便携收纳包",
        "selling_points": ["防水", "轻便"],
    }))

    assert result["success"] is True
    assert result["data"]["provider"] == "rule_engine"
    assert result["data"]["confidence"] == "low"
    assert "需人工确认" in result["data"]["text"]
    assert "ai_provider" in result["data"]["data_gaps"]


def test_task_executor_preserves_rule_engine_low_confidence():
    result = asyncio.run(execute_task(
        db=None,
        task_type="video_script",
        input_data={"product_name": "便携收纳包"},
        preferred_providers=["rule_engine"],
    ))

    assert result.success is True
    assert result.provider == "rule_engine"
    assert result.confidence == "low"
    assert "ai_provider" in result.data["data_gaps"]

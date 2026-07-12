"""Scout decision configuration evidence response regression tests."""

import asyncio
from types import SimpleNamespace

from app.api.v1.scout import DecisionRequest, execute_decision, get_decision_config


VALID_POLICY = {
    "green_threshold": 7,
    "yellow_threshold": 4,
    "green_required": 6,
    "yellow_required": 3,
    "dimensions": [
        {"key": "weight", "label": "重量", "help": "是否适合跨境物流"},
        {"key": "competition", "label": "竞争", "help": "竞品竞争强度"},
        {"key": "margin", "label": "利润", "help": "利润空间"},
        {"key": "video_show", "label": "视频表现", "help": "短视频展示潜力"},
        {"key": "seasonality", "label": "季节性", "help": "季节波动风险"},
        {"key": "supplier_count", "label": "供应商", "help": "供应稳定性"},
        {"key": "repurchase", "label": "复购", "help": "复购潜力"},
        {"key": "pain_point", "label": "痛点", "help": "解决痛点强度"},
        {"key": "price", "label": "价格", "help": "价格带适配"},
    ],
    "decisions": {
        "green": {"label": "绿灯", "action": "进入内容制作"},
        "yellow": {"label": "黄灯", "action": "补充验证"},
        "red": {"label": "红灯", "action": "暂缓"},
    },
}


def test_scout_decision_missing_policy_promotes_configuration_required(monkeypatch):
    async def no_policy(_db):
        return None

    monkeypatch.setattr("app.api.v1.scout._get_decision_policy", no_policy)

    response = asyncio.run(execute_decision(
        DecisionRequest(
            weight=5,
            competition=5,
            margin=5,
            video_show=5,
            seasonality=5,
            supplier_count=5,
            repurchase=5,
            pain_point=5,
            price=5,
        ),
        current_user=SimpleNamespace(id="user-a", username="admin"),
        db=None,
    ))

    assert response.status == "configuration_required"
    assert response.data_gaps == ["selection.decision_policy"]
    assert response.evidence_window == "当前九维选品决策策略配置"
    assert response.data["message"] == "九维选品决策必须读取统一策略配置。"


def test_scout_decision_config_missing_policy_promotes_configuration_required(monkeypatch):
    async def no_policy(_db):
        return None

    monkeypatch.setattr("app.api.v1.scout._get_decision_policy", no_policy)

    response = asyncio.run(get_decision_config(db=None))

    assert response.status == "configuration_required"
    assert response.data_gaps == ["selection.decision_policy"]
    assert response.source_refs[0].type == "system_config"


def test_scout_decision_config_accepts_nine_scoring_dimensions(monkeypatch):
    async def valid_policy(_db, _key):
        return VALID_POLICY

    monkeypatch.setattr("app.services.config_service.get_config_json", valid_policy)

    response = asyncio.run(get_decision_config(db=None))

    assert response.status == "ready"
    assert response.data["green_threshold"] == 7
    assert {item["key"] for item in response.data["dimensions"]} == {
        "weight", "competition", "margin", "video_show", "seasonality",
        "supplier_count", "repurchase", "pain_point", "price",
    }

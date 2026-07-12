import json
from unittest.mock import AsyncMock

import pytest

from app.services import config_service


@pytest.mark.asyncio
async def test_selection_decision_policy_uses_catalog_default(monkeypatch):
    monkeypatch.setattr(config_service, "_get_sys_config", AsyncMock(return_value=None))

    policy = await config_service.get_config_json(AsyncMock(), "selection.decision_policy")

    assert policy is not None
    assert policy["green_threshold"] == 7
    assert {item["key"] for item in policy["dimensions"]} == {
        "weight", "competition", "margin", "video_show", "seasonality",
        "supplier_count", "repurchase", "pain_point", "price",
    }


@pytest.mark.asyncio
async def test_persisted_decision_policy_overrides_catalog_default(monkeypatch):
    monkeypatch.setattr(
        config_service,
        "_get_sys_config",
        AsyncMock(return_value=json.dumps({"green_threshold": 82})),
    )

    policy = await config_service.get_config_json(AsyncMock(), "selection.decision_policy")

    assert policy == {"green_threshold": 82}

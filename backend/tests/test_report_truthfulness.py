"""Regression tests for truthful reports and product classification."""

import asyncio
from types import SimpleNamespace

from app.services.product_analysis import classify_sourcing_items
from datetime import datetime, timezone

from app.services.report_delivery_service import is_subscription_due
from app.services.report_service import _build_report, _detect_period_anomalies
from app.api.v1.reports import _report_response


def test_report_does_not_calculate_profit_when_cost_is_missing():
    order = SimpleNamespace(
        total=100,
        items=[
            SimpleNamespace(
                product_id=None,
                quantity=1,
                name="缺成本商品",
                total_price=100,
            )
        ],
        platform_account=None,
    )

    report = asyncio.run(_build_report(None, "user-a", [order], "2026-06-04", "daily"))

    assert report["summary"]["total_revenue"] == 100
    assert report["summary"]["total_cost"] is None
    assert report["summary"]["gross_profit"] is None
    assert report["summary"]["profit_margin_pct"] is None
    assert report["data_quality"]["missing_cost_items"] == 1
    assert report["data_quality"]["comparison_status"] == "not_evaluated"


def test_report_does_not_turn_empty_period_into_zero_profit():
    report = asyncio.run(_build_report(None, "user-a", [], "2026-06-04", "daily"))
    assert report["summary"]["total_cost"] is None
    assert report["summary"]["gross_profit"] is None
    assert report["summary"]["profit_margin_pct"] is None
    assert report["data_quality"]["missing_cost_items"] == 0


def test_report_uses_explicit_market_and_real_previous_period_comparison():
    current = SimpleNamespace(
        total=50,
        items=[],
        platform_account=SimpleNamespace(platform="shopee", settings={"market": "MY"}),
        platform_data={},
    )
    previous = SimpleNamespace(total=100)

    report = asyncio.run(
        _build_report(None, "user-a", [current], "2026-06-04", "daily", [previous])
    )

    assert report["by_market"] == [{"platform": "MY", "revenue": 50.0, "orders": 1}]
    assert report["data_quality"]["comparison_status"] == "ready"
    anomalies = _detect_period_anomalies([current], [previous])
    assert len(anomalies) == 1
    assert {key: anomalies[0][key] for key in ("metric", "expected", "actual", "deviation_pct")} == {
        "metric": "revenue", "expected": 100, "actual": 50, "deviation_pct": 50.0,
    }
    assert anomalies[0]["evidence_window"] == "当前报表周期与上一同等周期"


def test_product_classification_uses_known_revenue_and_marks_missing_metrics():
    items = [
        SimpleNamespace(
            product_name="完整商品",
            monthly_sales=10,
            profit_margin_pct=30,
            selling_price_local=20,
            pipeline_stage="active",
        ),
        SimpleNamespace(
            product_name="缺数据商品",
            monthly_sales=None,
            profit_margin_pct=None,
            selling_price_local=None,
            pipeline_stage="active",
        ),
    ]

    result = classify_sourcing_items(items)

    assert result["total_revenue"] == 200
    assert result["distribution"]["core"]["revenue_share"] == 100
    assert result["distribution"]["data_missing"]["count"] == 1
    assert result["revenue_status"] == "partial"
    assert result["status"] == "ready"
    assert result["source_refs"] == []
    assert result["evidence_window"] == "当前品源商品最新录入值"
    assert result["data_gaps"] == ["1个商品缺少销量、售价或利润率"]


def test_report_subscription_due_periods_and_rejects_fake_channels():
    now = datetime(2026, 6, 4, 8, tzinfo=timezone.utc)
    daily = SimpleNamespace(enabled=True, channel="in_app", frequency="daily", last_sent_at=None)
    assert is_subscription_due(daily, now) is True

    daily.last_sent_at = datetime(2026, 6, 4, 1, tzinfo=timezone.utc)
    assert is_subscription_due(daily, now) is False

    unsupported = SimpleNamespace(enabled=True, channel="email", frequency="daily", last_sent_at=None)
    assert is_subscription_due(unsupported, now) is False


def test_empty_report_response_is_data_required_not_ready_zero_kpi():
    response = _report_response({
        "summary": {"total_orders": 0, "total_revenue": 0},
        "source_refs": [],
        "evidence_window": "daily:2026-06-19",
        "confidence_reason": "无订单不输出经营结论",
        "data_gaps": ["期间没有真实订单记录"],
    })

    assert response.status == "data_required"
    assert response.data_gaps == ["期间没有真实订单记录"]

"""Regression tests for truthful trend and hot-product metrics."""

import asyncio
from types import SimpleNamespace

from app.integrations.shopee import scraper
from app.services.blue_ocean_radar import _generate_recommendation, _score_keyword
from app.services.discovery_service import extract_features_from_text
from app.services.trend_persistence import cross_validate_staging
from app.services.trending_sync_service import sync_trending_products


def test_cross_validation_uses_explicit_dual_source_rule():
    staging = [
        {
            "keyword": "portable blender",
            "market": "MY",
            "source": "google_trends",
            "search_volume": None,
            "trend_direction": "rising",
        },
        {
            "keyword": "portable blender",
            "market": "MY",
            "source": "pinterest",
            "search_volume": None,
            "trend_direction": "rising",
            "trend_data": [20, 40, 60],
        },
    ]

    assert cross_validate_staging(staging) == 1
    assert staging[0]["cross_validation_score"] == 100
    assert "双源精确匹配" in staging[0]["cross_validation_detail"]["scoring_basis"]
    assert staging[0]["pinterest_volume"] is None


def test_trending_sync_is_limited_to_approved_platforms():
    stats = asyncio.run(sync_trending_products(SimpleNamespace(), "user-a"))

    assert set(stats) == {"shopee", "temu", "tiktok", "total", "errors"}
    assert stats["total"] == 0


def test_shopee_empty_result_is_not_called_blue_ocean(monkeypatch):
    async def empty_search(keyword, market, market_config):
        return {"keyword": keyword, "market": market, "total_count": 0, "items": [], "error": None}

    monkeypatch.setattr(scraper, "search_keyword", empty_search)
    result = asyncio.run(scraper.analyze_competition(
        "unknown item",
        "MY",
        {"domains": {"shopee": "shopee.com.my"}},
    ))

    assert result["competition_score"] is None
    assert result["is_blue_ocean"] is False
    assert result["data_status"] == "insufficient"


def test_blue_ocean_missing_evidence_cannot_become_high_score():
    keyword = SimpleNamespace(
        id="kw-1",
        keyword="unknown item",
        market="MY",
        category="bags",
        search_volume=None,
        growth_pct=None,
        trend_direction=None,
        has_pinterest_data=False,
        cross_validation_score=None,
        competition_level=None,
    )

    result = _score_keyword(keyword, {}, {})

    assert result["blue_ocean_score"] == 0
    assert result["evidence_completeness_pct"] == 0
    assert result["dimensions"]["competition_gap"] is None
    assert "暂不生成入场结论" in _generate_recommendation(result)


def test_ocr_features_only_use_supplied_category_dictionary():
    result = extract_features_from_text("这是一个尼龙斜挎女包", ["女包", "斜挎包"])

    assert result["features"] == ["女包"]
    assert "尼龙" not in result["features"]

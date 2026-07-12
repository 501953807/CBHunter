"""Scout source configuration regression tests."""

from app.services.scout_source_config import get_scout_sources


def test_influential_signal_channels_are_explicitly_configured():
    sources = {source["id"]: source for source in get_scout_sources()}
    expected = {
        "xiaohongshu",
        "facebook_reels",
        "instagram_reels",
        "youtube_shorts",
        "x_trends",
        "pinterest",
        "tiktok_cc",
    }

    assert expected.issubset(sources)
    for source_id in expected:
        source = sources[source_id]
        assert source["layer"] in {"culture", "trend"}
        assert source["capture_method"] in {"manual_evidence", "public_trend", "authorized_api"}
        assert source["automation_status"] in {"manual_only", "public_available", "requires_authorization"}
        assert source["authorization_required"] is not None
        assert source["evidence_required"]


def test_unauthorized_sources_are_not_marked_as_automatic_collection():
    sources = get_scout_sources()

    for source in sources:
        if source.get("authorization_required"):
            assert source["automation_status"] != "public_available"
            assert "授权" in source["access_note"] or "手工" in source["access_note"]


def test_signal_layers_follow_broad_to_specific_funnel_order():
    sources = get_scout_sources()
    layer_order = {
        source["layer"]: (source["layer_sort_order"], source["layer_label"])
        for source in sources
    }

    assert layer_order["culture"] == (1, "社交文娱影响")
    assert layer_order["trend"] == (2, "流行趋势")
    assert layer_order["platform"] == (3, "销售平台")
    assert layer_order["supply"] == (4, "供应渠道")

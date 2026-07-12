"""Tests for evidence-only OCR fallback analysis."""

from app.services.image_analysis import extract_analysis, recommend_market


def test_ocr_fallback_does_not_invent_scores_titles_or_selling_points():
    analysis = extract_analysis("black leather bag", "bags")

    assert analysis["status"] == "data_required"
    assert analysis["market_score"]["score"] is None
    assert analysis["titles"] == {}
    assert analysis["selling_points"] == {}
    assert recommend_market(analysis) == []

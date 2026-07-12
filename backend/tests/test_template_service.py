"""Tests for structured Listing template rendering."""

from app.services.template_service import render_template_fields
from app.api.v1.templates import _find_unresolved


def test_render_template_fields_supports_canonical_and_legacy_variables():
    rendered = render_template_fields(
        {
            "title_template": "{{product_name}} {keywords}",
            "description_template": "品类: {{category}}",
        },
        {
            "product_name": "测试商品",
            "keywords": "核心词",
            "category": "家居",
        },
    )

    assert rendered["title_template"] == "测试商品 核心词"
    assert rendered["description_template"] == "品类: 家居"


def test_render_template_fields_supports_price_formulas():
    rendered = render_template_fields(
        {
            "markup_price": "{{price_markup:25}}",
            "fixed_price": "{{price_fixed:8.5}}",
        },
        {},
        cost_price=40,
    )

    assert rendered["markup_price"] == "50.0"
    assert rendered["fixed_price"] == "48.5"


def test_render_template_fields_preserves_price_formula_when_cost_is_missing():
    rendered = render_template_fields(
        {"markup_price": "{{price_markup:25}}"},
        {},
        cost_price=None,
    )

    assert rendered["markup_price"] == "{{price_markup:25}}"


def test_template_preview_reports_only_unresolved_variables():
    assert _find_unresolved({
        "title_template": "真实商品 {{brand}}",
        "description_template": "已解析内容",
        "price": "{{price_markup:20}}",
    }) == ["brand", "price_markup:20"]

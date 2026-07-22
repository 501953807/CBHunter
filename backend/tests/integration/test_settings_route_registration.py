"""Integration contract checks for split settings routers."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.api.router import api_router


def test_split_settings_routes_keep_original_urls_registered():
    paths = {getattr(route, "path", "") for route in api_router.routes}

    assert "/api/v1/settings/fee-rates" in paths
    assert "/api/v1/settings/pricing-adjustment-templates" in paths
    assert "/api/v1/settings/warehouses" in paths
    assert "/api/v1/settings/warehouses/{wh_id}" in paths


def test_split_discovery_trend_routes_keep_original_urls_registered():
    paths = {getattr(route, "path", "") for route in api_router.routes}

    assert "/api/v1/discovery/trends" in paths
    assert "/api/v1/discovery/trends/fetch" in paths
    assert "/api/v1/discovery/trends/status" in paths
    assert "/api/v1/discovery/trends/{keyword_id}" in paths
    assert "/api/v1/discovery/trend-keywords" in paths
    assert "/api/v1/discovery/captured-keywords" in paths

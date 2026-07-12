"""Tests for sourcing cost calculation."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from app.services.sourcing_service import calculate_cost


def full_cost_payload(**overrides):
    data = {
        "source_price_rmb": 30,
        "selling_price_local": 100,
        "exchange_rate": 1.0,
        "domestic_shipping_rmb": 5,
        "intl_shipping_rmb": 10,
        "packaging_cost_rmb": 2,
        "platform_fee_pct": 6,
        "payment_fee_pct": 2,
        "return_reserve_pct": 3,
    }
    data.update(overrides)
    return data


class TestCostCalculation:
    def test_basic_profit_scenario(self):
        """With reasonable margins, should show profit."""
        result = calculate_cost(full_cost_payload())
        assert result["total_cost_rmb"] > 0
        assert result["profit_rmb"] > 0
        assert result["profit_margin_pct"] > 0

    def test_loss_scenario(self):
        result = calculate_cost(full_cost_payload(source_price_rmb=100, selling_price_local=50))
        assert result["profit_rmb"] < 0
        assert result["profit_margin_pct"] < 0

    def test_breakeven_when_profitable(self):
        result = calculate_cost(full_cost_payload(source_price_rmb=10, selling_price_local=50))
        assert result["breakeven_units"] == 1

    def test_breakeven_when_unprofitable(self):
        result = calculate_cost(full_cost_payload(source_price_rmb=100, selling_price_local=10))
        assert result["breakeven_units"] == float("inf")

    def test_zero_exchange_rate(self):
        with pytest.raises(ValueError):
            calculate_cost(full_cost_payload(exchange_rate=0))

    def test_details_contain_all_fields(self):
        result = calculate_cost(full_cost_payload(selling_price_local=59.9))
        details = result["details"]
        assert "purchase_price_rmb" in details
        assert "platform_fee_rmb" in details
        assert "exchange_rate" in details

    def test_missing_cost_fields_rejected(self):
        """Cost calculation must not apply hidden default fees or shipping."""
        with pytest.raises(ValueError):
            calculate_cost({
                "source_price_rmb": 30,
                "selling_price_local": 100,
                "exchange_rate": 1.0,
            })

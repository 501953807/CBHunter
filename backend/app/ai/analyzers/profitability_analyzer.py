"""Profitability analyzer using caller-supplied real cost configuration.

This module intentionally does not embed platform fees, exchange rates, or
shipping rates. Callers must load those values from FeeTemplate, ExchangeRate,
and actual logistics inputs before using the calculator.
"""

from dataclasses import dataclass, field
from typing import Iterable, Optional


@dataclass
class ProfitCalculation:
    purchase_cost_rmb: float
    weight_g: int
    target_platform: str
    target_market: str
    suggested_selling_price_local: float
    suggested_selling_price_rmb_equiv: float
    shipping_cost_rmb: float
    platform_commission_rmb: float
    transaction_fee_rmb: float
    total_cost_rmb: float
    net_profit_rmb: float
    profit_margin_pct: float
    markup_from_cost: float
    is_viable: bool
    viability_label: str
    note: str = ""


@dataclass
class ProfitScenario:
    """A scenario showing profit at a specific selling price."""

    selling_price_local: float
    selling_price_rmb: float
    platform_fee_rmb: float
    net_profit_rmb: float
    profit_margin_pct: float


@dataclass
class FullProfitAnalysis:
    """Complete profitability analysis for a product on a target platform."""

    purchase_cost_rmb: float
    weight_g: int
    target_platform: str
    target_market: str
    platform_display: str
    market_display: str
    currency: str
    exchange_rate: float
    shipping_cost_rmb: float
    commission_rate: float
    transaction_fee_rate: float
    scenarios: list[ProfitScenario] = field(default_factory=list)
    recommended_price: Optional[float] = None
    recommended_markup: Optional[float] = None
    breakeven_price_local: Optional[float] = None
    breakeven_price_rmb: Optional[float] = None


def calculate_profit(
    purchase_cost_rmb: float,
    weight_g: int,
    target_platform: str,
    target_market: str,
    shipping_cost_rmb: float,
    currency: str,
    exchange_rate: float,
    commission_rate: float,
    transaction_fee_rate: float,
    markup_multiples: Optional[Iterable[float]] = None,
) -> FullProfitAnalysis:
    """Calculate profit from explicit real inputs.

    `commission_rate` and `transaction_fee_rate` are decimal rates, e.g. 0.12.
    """
    if shipping_cost_rmb <= 0:
        raise ValueError("shipping_cost_rmb is required")
    if exchange_rate <= 0:
        raise ValueError("exchange_rate is required")
    if not currency:
        raise ValueError("currency is required")

    multiples = list(markup_multiples or [])
    if not multiples:
        raise ValueError("markup_multiples is required")

    scenarios = []
    base_cost = purchase_cost_rmb + shipping_cost_rmb
    fee_rates = commission_rate + transaction_fee_rate
    for markup_multiple in multiples:
        selling_price_rmb = base_cost * markup_multiple
        selling_price_local = selling_price_rmb * exchange_rate
        total_fees = selling_price_rmb * fee_rates
        net_profit = selling_price_rmb - purchase_cost_rmb - shipping_cost_rmb - total_fees
        margin = (net_profit / selling_price_rmb) * 100 if selling_price_rmb > 0 else 0

        scenarios.append(ProfitScenario(
            selling_price_local=round(selling_price_local, 2),
            selling_price_rmb=round(selling_price_rmb, 2),
            platform_fee_rmb=round(total_fees, 2),
            net_profit_rmb=round(net_profit, 2),
            profit_margin_pct=round(margin, 1),
        ))

    recommended = next((s for s in scenarios if s.profit_margin_pct >= 20), scenarios[-1])
    if fee_rates >= 1.0:
        breakeven_rmb = float("inf")
    else:
        breakeven_rmb = base_cost / (1 - fee_rates)

    recommended_markup = round(recommended.selling_price_rmb / base_cost, 2) if base_cost > 0 else None
    return FullProfitAnalysis(
        purchase_cost_rmb=purchase_cost_rmb,
        weight_g=weight_g,
        target_platform=target_platform,
        target_market=target_market,
        platform_display=target_platform,
        market_display=target_market,
        currency=currency,
        exchange_rate=exchange_rate,
        shipping_cost_rmb=round(shipping_cost_rmb, 2),
        commission_rate=commission_rate,
        transaction_fee_rate=transaction_fee_rate,
        scenarios=scenarios,
        recommended_price=round(recommended.selling_price_local, 2),
        recommended_markup=recommended_markup,
        breakeven_price_local=round(breakeven_rmb * exchange_rate, 2),
        breakeven_price_rmb=round(breakeven_rmb, 2),
    )


def get_viability_label(profit_margin: float) -> str:
    if profit_margin >= 35:
        return "高利润"
    if profit_margin >= 20:
        return "可行"
    if profit_margin >= 10:
        return "微利"
    return "亏损"


def analyze_product_profitability(
    purchase_cost_rmb: float,
    weight_g: int,
    platform: str,
    market: str,
    shipping_cost_rmb: float,
    currency: str,
    exchange_rate: float,
    commission_rate: float,
    transaction_fee_rate: float,
    markup_multiples: Iterable[float],
) -> ProfitCalculation:
    """Simple one-shot profitability analysis from explicit real inputs."""
    analysis = calculate_profit(
        purchase_cost_rmb=purchase_cost_rmb,
        weight_g=weight_g,
        target_platform=platform,
        target_market=market,
        shipping_cost_rmb=shipping_cost_rmb,
        currency=currency,
        exchange_rate=exchange_rate,
        commission_rate=commission_rate,
        transaction_fee_rate=transaction_fee_rate,
        markup_multiples=markup_multiples,
    )
    rec = next((s for s in analysis.scenarios if s.selling_price_local == analysis.recommended_price), analysis.scenarios[-1])
    selling_price_rmb = rec.selling_price_rmb
    commission_rmb = rec.selling_price_rmb * analysis.commission_rate
    transaction_rmb = rec.selling_price_rmb * analysis.transaction_fee_rate
    total_cost = purchase_cost_rmb + analysis.shipping_cost_rmb + commission_rmb + transaction_rmb
    net_profit = selling_price_rmb - total_cost
    margin = (net_profit / selling_price_rmb) * 100 if selling_price_rmb > 0 else 0
    viability = get_viability_label(margin)
    base_cost = purchase_cost_rmb + analysis.shipping_cost_rmb

    return ProfitCalculation(
        purchase_cost_rmb=purchase_cost_rmb,
        weight_g=weight_g,
        target_platform=platform,
        target_market=market,
        suggested_selling_price_local=rec.selling_price_local,
        suggested_selling_price_rmb_equiv=round(selling_price_rmb, 2),
        shipping_cost_rmb=round(analysis.shipping_cost_rmb, 2),
        platform_commission_rmb=round(commission_rmb, 2),
        transaction_fee_rmb=round(transaction_rmb, 2),
        total_cost_rmb=round(total_cost, 2),
        net_profit_rmb=round(net_profit, 2),
        profit_margin_pct=round(margin, 1),
        markup_from_cost=round(selling_price_rmb / base_cost, 1) if base_cost > 0 else 0,
        is_viable=viability in ("可行", "高利润"),
        viability_label=viability,
        note=generate_note(viability),
    )


def generate_note(viability: str) -> str:
    if viability == "高利润":
        return "该产品利润空间充足，可进入上架准备。"
    if viability == "可行":
        return "利润适中，可以上架但需继续控制采购、物流和费率成本。"
    if viability == "微利":
        return "利润偏低，建议寻找更便宜的供应链或提高售价。"
    return "亏损风险较高，不建议上架。"

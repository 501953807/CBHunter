"""Pydantic schemas for profitability analysis."""
from pydantic import BaseModel, Field
from typing import Optional


class ProfitScenarioResponse(BaseModel):
    selling_price_local: float
    selling_price_rmb: float
    platform_fee_rmb: float
    net_profit_rmb: float
    profit_margin_pct: float


class FullProfitResponse(BaseModel):
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
    scenarios: list[ProfitScenarioResponse]
    recommended_price: Optional[float] = None
    recommended_markup: Optional[float] = None
    breakeven_price_local: Optional[float] = None
    breakeven_price_rmb: Optional[float] = None


class ProfitabilityRequest(BaseModel):
    purchase_cost_rmb: float = Field(gt=0)
    weight_g: int = Field(gt=0)
    platform: str
    market: str
    shipping_cost_rmb: Optional[float] = None  # override default shipping estimate
    markup_pct: float = Field(gt=0)


class SimpleProfitResult(BaseModel):
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
    note: str

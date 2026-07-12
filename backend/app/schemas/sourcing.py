"""Schemas for product sourcing/tracking."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class SupplierCreate(BaseModel):
    sourcing_item_id: str
    supplier_name: str
    supplier_url: Optional[str] = None
    product_image: Optional[str] = None
    purchase_price_rmb: Optional[float] = None
    shipping_estimate_rmb: Optional[float] = None
    moq: Optional[int] = None
    notes: Optional[str] = None
    rating: Optional[str] = None
    is_preferred: bool = False


class SupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sourcing_item_id: str
    supplier_name: str
    supplier_url: Optional[str] = None
    product_image: Optional[str] = None
    purchase_price_rmb: Optional[float] = None
    shipping_estimate_rmb: Optional[float] = None
    moq: Optional[int] = None
    notes: Optional[str] = None
    rating: Optional[str] = None
    is_preferred: bool = False
    created_at: Optional[datetime] = None

class SourcingItemCreate(BaseModel):
    source_name: str = "1688"
    source_url: Optional[str] = None
    source_price_rmb: Optional[float] = None
    product_name: str
    product_name_cn: Optional[str] = None
    weight_g: Optional[float] = None
    category: Optional[str] = None
    platform: Optional[str] = None
    market: Optional[str] = None
    pipeline_stage: str = "discovery"
    notes: Optional[str] = None
    tags: Optional[list[str]] = None


class SourcingItemUpdate(BaseModel):
    source_url: Optional[str] = None
    source_price_rmb: Optional[float] = None
    product_name: Optional[str] = None
    product_name_cn: Optional[str] = None
    weight_g: Optional[float] = None
    category: Optional[str] = None
    platform: Optional[str] = None
    market: Optional[str] = None
    pipeline_stage: Optional[str] = None
    price_review_status: Optional[str] = None
    price_review_note: Optional[str] = None
    jit_stock: Optional[int] = None
    vmi_stock: Optional[int] = None
    selling_price_local: Optional[float] = None
    monthly_sales: Optional[int] = None
    profit_margin_pct: Optional[float] = None
    domestic_shipping_rmb: Optional[float] = None
    intl_shipping_rmb: Optional[float] = None
    packaging_cost_rmb: Optional[float] = None
    platform_fee_pct: Optional[float] = None
    payment_fee_pct: Optional[float] = None
    return_reserve_pct: Optional[float] = None
    exchange_rate: Optional[float] = None
    total_cost_rmb: Optional[float] = None
    listing_url: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    is_active: Optional[bool] = None


class SourcingItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_name: str
    source_url: Optional[str] = None
    source_price_rmb: Optional[float] = None
    product_name: str
    product_name_cn: Optional[str] = None
    weight_g: Optional[float] = None
    category: Optional[str] = None
    platform: Optional[str] = None
    market: Optional[str] = None
    pipeline_stage: str
    price_review_status: Optional[str] = None
    price_review_note: Optional[str] = None
    jit_stock: Optional[int] = None
    vmi_stock: Optional[int] = None
    selling_price_local: Optional[float] = None
    monthly_sales: Optional[int] = None
    profit_margin_pct: Optional[float] = None
    domestic_shipping_rmb: Optional[float] = None
    intl_shipping_rmb: Optional[float] = None
    packaging_cost_rmb: Optional[float] = None
    platform_fee_pct: Optional[float] = None
    payment_fee_pct: Optional[float] = None
    return_reserve_pct: Optional[float] = None
    exchange_rate: Optional[float] = None
    total_cost_rmb: Optional[float] = None
    listing_url: Optional[str] = None
    source_image: Optional[str] = None
    extra_data: Optional[dict] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class SourcingPipelineSummary(BaseModel):
    total: int = 0
    discovery: int = 0
    jit_testing: int = 0
    jit_passed: int = 0
    price_review: int = 0
    vmi: int = 0
    active: int = 0
    discontinued: int = 0
    by_platform: dict = Field(default_factory=dict)


class CostCalculationRequest(BaseModel):
    """Input for cost/profit calculation."""
    source_price_rmb: float
    selling_price_local: float
    domestic_shipping_rmb: float
    intl_shipping_rmb: float
    packaging_cost_rmb: float
    platform_fee_pct: float
    payment_fee_pct: float
    return_reserve_pct: float
    exchange_rate: float
    weight_g: Optional[float] = None
    shipping_rule: Optional[str] = None  # 'by_weight' | 'by_volume' | 'fixed'


class PurchaseLedgerRequest(BaseModel):
    """Record a sourcing purchase into the finance ledger."""
    supplier_id: Optional[str] = None
    quantity: int = 1
    unit_cost_rmb: float
    domestic_shipping_rmb: float = 0
    description: Optional[str] = None


class CostCalculationResponse(BaseModel):
    """Full cost breakdown."""
    total_cost_rmb: float
    profit_rmb: float
    profit_margin_pct: float
    breakeven_units: float
    details: dict

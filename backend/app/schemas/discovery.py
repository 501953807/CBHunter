"""Schemas for product discovery and trend tracking."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class DiscoveryCreate(BaseModel):
    source_type: str = "manual"
    source_url: Optional[str] = None
    product_name: Optional[str] = ""
    product_type: Optional[str] = ""
    category: Optional[str] = ""
    market: Optional[str] = None
    features: Optional[list[str]] = None
    selling_points: Optional[list[str]] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None


class DiscoveryUpdate(BaseModel):
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    category: Optional[str] = None
    features: Optional[list[str]] = None
    selling_points: Optional[list[str]] = None
    sourcing_price_rmb: Optional[float] = None
    suggested_price_local: Optional[float] = None
    estimated_profit_margin: Optional[float] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None


class DiscoveryDecision(BaseModel):
    decision: str  # pursue, maybe, reject
    reason: Optional[str] = None


class DiscoveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_type: str
    source_image: Optional[str] = None
    source_url: Optional[str] = None
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    category: Optional[str] = None
    market: Optional[str] = None
    features: Optional[list] = None
    selling_points: Optional[list] = None
    target_audience: Optional[str] = None
    matched_trend_keywords: Optional[list] = None
    trend_score: Optional[float] = None
    market_demand: Optional[str] = None
    sourcing_price_rmb: Optional[float] = None
    suggested_price_local: Optional[float] = None
    estimated_profit_margin: Optional[float] = None
    status: str
    decision: Optional[str] = None
    decision_reason: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list] = None
    analyzed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

class TrendKeywordCreate(BaseModel):
    keyword: str
    market: Optional[str] = None
    category: Optional[str] = None


class TrendDataUpdate(BaseModel):
    search_volume: Optional[int] = None
    trend_direction: Optional[str] = None
    growth_pct: Optional[float] = None
    competition_level: Optional[str] = None
    source: Optional[str] = None


class TrendKeywordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    keyword: str
    market: str
    market_name: str
    category: str
    search_volume: Optional[int] = None
    trend_direction: Optional[str] = None
    growth_pct: Optional[float] = None
    trend_data: list = Field(default_factory=list)
    related_top: list = Field(default_factory=list)
    related_rising: list = Field(default_factory=list)
    last_fetched_at: Optional[str] = None
    source: str = "manual"
    # Pinterest data
    pinterest_volume: Optional[int] = None
    pinterest_direction: Optional[str] = None
    pinterest_growth: Optional[float] = None
    pinterest_trend_data: list = Field(default_factory=list)
    has_pinterest_data: bool = False
    # Cross-validation
    cross_validation_score: Optional[int] = None
    cross_validation_detail: Optional[dict] = None
    cross_validated_at: Optional[str] = None

class CrossValidationResult(BaseModel):
    keyword: str
    market: str
    category: str
    match_type: str = "exact"  # exact / substring / token_overlap / category_loose
    similarity: Optional[float] = None
    google: Optional[dict] = None
    pinterest: Optional[dict] = None
    cross_score: Optional[int] = None
    signal_strength: str = "no_data"  # strong / moderate / weak / conflicting / no_data
    consensus_direction: Optional[str] = None
    auto_signaled: bool = False


class CapturedKeywordResponse(BaseModel):
    """Schema for user-captured keyword history."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    keyword: str
    market: str
    category: str
    search_volume: Optional[int] = None
    trend_direction: Optional[str] = None
    growth_pct: Optional[float] = None
    trend_data: list = Field(default_factory=list)
    source: str = "manual"
    pinterest_volume: Optional[int] = None
    pinterest_direction: Optional[str] = None
    pinterest_growth: Optional[float] = None
    pinterest_trend_data: list = Field(default_factory=list)
    has_pinterest_data: bool = False
    cross_validation_score: Optional[int] = None
    cross_validation_detail: Optional[dict] = None
    cross_validated_at: Optional[str] = None
    captured_at: Optional[str] = None

class DiscoveryPipelineStats(BaseModel):
    total: int = 0
    by_status: dict = Field(default_factory=dict)
    by_decision: dict = Field(default_factory=dict)
    by_category: dict = Field(default_factory=dict)

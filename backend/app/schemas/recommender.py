"""Pydantic schemas for product recommender."""
from pydantic import BaseModel, Field
from typing import Optional


class ProductRecommendationResponse(BaseModel):
    work_item_id: Optional[str] = None
    object_refs: list[dict] = Field(default_factory=list)
    lifecycle_status: Optional[str] = None
    lifecycle_label: Optional[str] = None
    evidence_completeness: dict[str, str] = Field(default_factory=dict)
    evidence_summary: dict[str, int] = Field(default_factory=dict)
    category: Optional[str] = None
    product_name: str
    product_name_cn: str
    image_url: Optional[str] = None
    image_count: int = 0
    source_url: Optional[str] = None
    source_label: Optional[str] = None
    target_platform: str
    target_market: str
    demand_level: str
    score: int = 0
    search_volume: Optional[int] = None
    competition_level: str
    avg_price_local: Optional[float] = None
    avg_price_rmb_equivalent: Optional[float] = None
    suggested_sourcing_price_rmb: Optional[str] = None
    suggested_selling_price_local: Optional[float] = None
    profit_potential: str
    keywords: list[str] = Field(default_factory=list)
    listing_tips: list[str] = Field(default_factory=list)
    trend_direction: Optional[str] = None
    seasonal: bool = False
    decision_level: str = "red"
    decision_label: str = "红灯：暂缓投入"
    decision_action: str = "先补齐真实资料再进入内容制作和刊登。"
    source_refs: list[dict] = Field(default_factory=list)
    evidence_window: Optional[str] = None
    confidence_reason: Optional[str] = None
    data_gaps: list[str] = Field(default_factory=list)
    product_context: dict = Field(default_factory=dict)
    experience_notes: list[dict] = Field(default_factory=list)


class RecommenderRequest(BaseModel):
    platform: str
    market: str
    category: Optional[str] = None


class RecommenderResponse(BaseModel):
    platform: str
    market: str
    status: str = "data_required"
    note: Optional[str] = None
    data_gaps: list[str] = Field(default_factory=list)
    source_refs: list[dict] = Field(default_factory=list)
    evidence_window: Optional[str] = None
    confidence_reason: Optional[str] = None
    generated_at: Optional[str] = None
    available_categories: list[str] = Field(default_factory=list)
    total_recommendations: int = 0
    high_demand_count: int = 0
    high_profit_count: int = 0
    recommendations: list[ProductRecommendationResponse] = Field(default_factory=list)


class RecommenderReadinessResponse(BaseModel):
    platform: str
    market: str
    rules_decision_status: str
    model_training_status: str
    counts: dict[str, int]
    minimums: dict[str, int]
    rule_gaps: list[str] = Field(default_factory=list)
    data_gaps: list[str] = Field(default_factory=list)
    source_refs: list[dict] = Field(default_factory=list)
    evidence_window: Optional[str] = None
    confidence_reason: Optional[str] = None
    required_actions: list[str] = Field(default_factory=list)
    note: str

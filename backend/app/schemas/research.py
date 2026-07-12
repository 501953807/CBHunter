from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class KeywordResearchResult(BaseModel):
    keyword: str
    platform: str
    search_volume: Optional[int] = None
    competition_level: Optional[str] = None
    avg_price: Optional[float] = None
    total_results: Optional[int] = None
    related_keywords: list[dict] = Field(default_factory=list)
    trend_data: list[dict] = Field(default_factory=list)


class SavedResearchCreate(BaseModel):
    keyword: str
    platform: str


class SavedResearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    keyword: str
    platform: str
    search_volume: Optional[int] = None
    competition_level: Optional[str] = None
    avg_price: Optional[float] = None
    analyzed_at: Optional[datetime] = None

class CompetitorCreate(BaseModel):
    platform: str
    platform_product_id: Optional[str] = None
    name: str
    seller_name: Optional[str] = None
    price: Optional[float] = None
    url: Optional[str] = None


class CompetitorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    platform: str
    name: str
    seller_name: Optional[str] = None
    price: Optional[float] = None
    sales_estimate: Optional[int] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    is_tracked: bool = True
    last_updated: Optional[datetime] = None

class TrendingProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    platform: str
    name: str
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    sales_volume: Optional[int] = None
    sales_growth_rate: Optional[float] = None
    category_path: Optional[str] = None
    category_label: Optional[str] = None  # Resolved Chinese label from dictionary
    tags: list[str] = Field(default_factory=list)

class TrendingProductCreate(BaseModel):
    platform: str
    name: str
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    sales_volume: Optional[int] = None
    sales_growth_rate: Optional[float] = None
    category_path: Optional[str] = None
    market: Optional[str] = None  # Market tag for filtering (MY/PH/SG/TH/VN/ID)


class SyncStats(BaseModel):
    shopee: int = 0
    temu: int = 0
    tiktok: int = 0
    total: int = 0
    errors: list[str] = Field(default_factory=list)

"""Report schemas."""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class DailyReportSummary(BaseModel):
    total_revenue: float = 0
    total_orders: int = 0
    total_cost: Optional[float] = None
    gross_profit: Optional[float] = None
    profit_margin_pct: Optional[float] = None


class PlatformBreakdown(BaseModel):
    platform: str
    revenue: float = 0
    orders: int = 0


class TopProduct(BaseModel):
    name: str
    quantity: int = 0
    revenue: float = 0


class Anomaly(BaseModel):
    metric: str
    expected: float
    actual: float
    deviation_pct: float


class ReportResponse(BaseModel):
    date: str
    period: str
    summary: DailyReportSummary
    by_platform: list[PlatformBreakdown] = Field(default_factory=list)
    by_market: list[PlatformBreakdown] = Field(default_factory=list)
    top_products: list[TopProduct] = Field(default_factory=list)
    anomalies: list[Anomaly] = Field(default_factory=list)


class ReportSubscriptionCreate(BaseModel):
    channel: Literal["in_app"]
    frequency: Literal["daily", "weekly", "monthly"]


class ReportSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    channel: str
    frequency: str
    enabled: bool
    last_sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

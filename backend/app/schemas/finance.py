"""Schemas for finance ledger APIs."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FinanceLedgerCreate(BaseModel):
    entry_type: str = Field(..., min_length=1, max_length=50)
    amount_rmb: float
    amount_original: Optional[float] = None
    currency: str = "CNY"
    platform: Optional[str] = None
    market: Optional[str] = None
    order_id: Optional[str] = None
    sourcing_item_id: Optional[str] = None
    description: Optional[str] = None
    extra: dict = Field(default_factory=dict)
    occurred_at: Optional[datetime] = None


class FinanceLedgerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    entry_type: str
    amount_rmb: float
    amount_original: Optional[float] = None
    currency: str
    platform: Optional[str] = None
    market: Optional[str] = None
    order_id: Optional[str] = None
    sourcing_item_id: Optional[str] = None
    description: Optional[str] = None
    extra: dict
    occurred_at: datetime


class PlatformBillImportRecord(BaseModel):
    import_ref: Optional[str] = None
    entry_type: str = Field(..., min_length=1, max_length=50)
    amount_rmb: float
    amount_original: Optional[float] = None
    currency: str = "CNY"
    platform: Optional[str] = None
    market: Optional[str] = None
    order_id: Optional[str] = None
    sourcing_item_id: Optional[str] = None
    account_name: Optional[str] = None
    product_name: Optional[str] = None
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None


class PlatformBillImportRequest(BaseModel):
    records: list[PlatformBillImportRecord] = Field(..., min_length=1, max_length=200)


class PlatformBillImportSkipped(BaseModel):
    import_ref: Optional[str] = None
    reason: str


class PlatformBillImportResponse(BaseModel):
    imported_count: int
    skipped_count: int
    imported_entry_ids: list[str] = Field(default_factory=list)
    skipped: list[PlatformBillImportSkipped] = Field(default_factory=list)


class PlatformBillSyncRequest(BaseModel):
    platform_account_id: str = Field(..., min_length=1)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None


class PlatformBillSyncResponse(BaseModel):
    sync_log_id: str
    status: str
    platform_account_id: str
    platform: str
    account_name: str
    connection_status: Optional[str] = None
    implementation_status: Optional[str] = None
    import_result: PlatformBillImportResponse
    data_gaps: list[str] = Field(default_factory=list)
    message: Optional[str] = None
    next_action: Optional[str] = None


class PlatformWalletBalance(BaseModel):
    platform: Optional[str] = None
    market: Optional[str] = None
    amount_rmb: float
    amount_original: Optional[float] = None
    currency: str
    account_name: Optional[str] = None
    reference_rate: Optional[str] = None
    source_entry_id: str
    occurred_at: Optional[str] = None


class OrderReconciliationSummary(BaseModel):
    linked_order_count: int
    linked_entry_count: int


class PlatformSettlementSummary(BaseModel):
    wallet_balances: list[PlatformWalletBalance] = Field(default_factory=list)
    movement_totals: dict[str, float] = Field(default_factory=dict)
    order_reconciliation: OrderReconciliationSummary


class FinanceRiskSignal(BaseModel):
    code: str
    level: str
    title: str
    detail: str
    action_label: str
    action_route: str


class FinanceTracebackSummary(BaseModel):
    order_count: int
    product_count: int
    store_count: int
    entry_count: int


class FinanceOrderTraceback(BaseModel):
    order_id: str
    platform: Optional[str] = None
    market: Optional[str] = None
    account_name: Optional[str] = None
    revenue_rmb: Optional[float] = None
    cost_rmb: Optional[float] = None
    net_profit_rmb: Optional[float] = None
    cost_breakdown: dict[str, float] = Field(default_factory=dict)
    entry_count: int
    source_entry_ids: list[str] = Field(default_factory=list)
    data_gaps: list[str] = Field(default_factory=list)


class FinanceProductTraceback(BaseModel):
    product_id: str
    product_name: str
    platform: Optional[str] = None
    market: Optional[str] = None
    revenue_rmb: Optional[float] = None
    cost_rmb: Optional[float] = None
    net_profit_rmb: Optional[float] = None
    cost_breakdown: dict[str, float] = Field(default_factory=dict)
    entry_count: int
    source_entry_ids: list[str] = Field(default_factory=list)
    data_gaps: list[str] = Field(default_factory=list)


class FinanceStoreTraceback(BaseModel):
    store_key: str
    platform: Optional[str] = None
    market: Optional[str] = None
    account_name: Optional[str] = None
    revenue_rmb: Optional[float] = None
    cost_rmb: Optional[float] = None
    net_profit_rmb: Optional[float] = None
    cost_breakdown: dict[str, float] = Field(default_factory=dict)
    entry_count: int
    source_entry_ids: list[str] = Field(default_factory=list)
    data_gaps: list[str] = Field(default_factory=list)


class FinanceTracebackResponse(BaseModel):
    period: str
    summary: FinanceTracebackSummary
    by_order: list[FinanceOrderTraceback] = Field(default_factory=list)
    by_product: list[FinanceProductTraceback] = Field(default_factory=list)
    by_store: list[FinanceStoreTraceback] = Field(default_factory=list)
    data_status: str


class FinanceSummaryResponse(BaseModel):
    period: str
    total_revenue_rmb: Optional[float]
    total_cost_rmb: Optional[float]
    net_profit_rmb: Optional[float]
    profit_margin_pct: Optional[float]
    cash_balance_rmb: Optional[float]
    entry_count: int
    cost_breakdown: dict[str, float]
    platform_settlement: PlatformSettlementSummary
    risk_signals: list[FinanceRiskSignal] = Field(default_factory=list)
    data_status: str

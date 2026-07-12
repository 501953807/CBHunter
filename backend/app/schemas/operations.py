"""Schemas for advertising, influencer, and receivable operating records."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class OperationRecordCreate(BaseModel):
    record_type: str = Field(min_length=1, max_length=50)
    status: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=255)
    platform: Optional[str] = None
    market: Optional[str] = None
    counterparty: str = Field(min_length=1, max_length=255)
    planned_amount_rmb: float = Field(ge=0)
    actual_amount_rmb: Optional[float] = Field(None, ge=0)
    currency: str = "CNY"
    due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)


class OperationRecordUpdate(BaseModel):
    record_type: Optional[str] = Field(None, min_length=1, max_length=50)
    status: Optional[str] = Field(None, min_length=1, max_length=30)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    platform: Optional[str] = None
    market: Optional[str] = None
    counterparty: Optional[str] = None
    planned_amount_rmb: Optional[float] = Field(None, ge=0)
    actual_amount_rmb: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = None
    due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    metrics: Optional[dict[str, Any]] = None
    extra: Optional[dict[str, Any]] = None


class OperationRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    record_type: str
    status: str
    name: str
    platform: Optional[str] = None
    market: Optional[str] = None
    counterparty: Optional[str] = None
    planned_amount_rmb: Optional[float] = None
    actual_amount_rmb: Optional[float] = None
    currency: str
    due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)
    ledger_entry_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProductDiagnosticActionCreate(BaseModel):
    listing_id: str = Field(min_length=1)
    diagnostic_code: str = Field(min_length=1, max_length=80)

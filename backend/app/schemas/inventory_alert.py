"""Inventory alert schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class InventoryAlertRuleCreate(BaseModel):
    product_id: str
    sku: str
    product_name: str
    safety_stock: int = 10
    severity: str


class InventoryAlertRuleUpdate(BaseModel):
    safety_stock: Optional[int] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None


class InventoryAlertRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    product_id: str
    sku: str
    product_name: str
    safety_stock: int
    enabled: bool
    severity: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class InventoryAlertLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    rule_id: str
    user_id: str
    product_id: str
    sku: str
    product_name: str
    current_stock: int
    threshold: int
    severity: str
    status: str
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    cleared_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

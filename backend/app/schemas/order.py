from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    platform_listing_id: Optional[str] = None
    product_id: Optional[str] = None
    sku: Optional[str] = None
    name: str
    quantity: int
    unit_price: float
    total_price: float
    variation_info: Optional[dict] = None
    v5_sku_context: dict = Field(default_factory=dict)

class OrderListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: Optional[str] = None
    platform: str = ""
    source: str = "platform"
    status: str
    buyer_name: Optional[str] = None
    platform_account_name: Optional[str] = None
    item_count: int = 0
    total: float
    currency: str = "CNY"
    payment_status: Optional[str] = None
    fulfillment_status: Optional[str] = None
    fulfillment_deadline_at: Optional[str] = None
    logistics_channel: Optional[str] = None
    after_sales_status: Optional[str] = None
    financial_reconciliation_status: str = "not_reconciled"
    platform_sync_status: dict = Field(default_factory=dict)
    fulfillment_exception: dict = Field(default_factory=dict)
    ordered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

class OrderDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    platform_account_id: str
    platform_order_id: str
    order_number: Optional[str] = None
    platform: str = ""
    source: str = "platform"
    status: str
    buyer_name: Optional[str] = None
    buyer_notes: Optional[str] = None
    shipping_address: Optional[dict] = None
    subtotal: Optional[float] = None
    shipping_fee: Optional[float] = None
    platform_fee: Optional[float] = None
    discount: Optional[float] = None
    total: float
    currency: str = "CNY"
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    fulfillment_status: Optional[str] = None
    fulfillment_deadline_at: Optional[str] = None
    logistics_channel: Optional[str] = None
    after_sales_status: Optional[str] = None
    financial_reconciliation_status: str = "not_reconciled"
    fee_breakdown: dict = Field(default_factory=dict)
    platform_sync_review: dict = Field(default_factory=dict)
    fulfillment_exception: dict = Field(default_factory=dict)
    finance_entry_context: dict = Field(default_factory=dict)
    notes: Optional[str] = None
    ordered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    items: list[OrderItemResponse] = Field(default_factory=list)

class OrderStatusUpdate(BaseModel):
    status: str
    manual_override: bool = False
    reason: Optional[str] = Field(None, max_length=500)


class OrderNoteUpdate(BaseModel):
    notes: str


class ManualOrderItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    sku: Optional[str] = Field(None, max_length=100)
    quantity: int = Field(..., ge=1)
    unit_price: float = Field(..., ge=0)


class ManualOrderCreate(BaseModel):
    platform_account_id: str = Field(..., min_length=1)
    merchant_order_number: str = Field(..., min_length=1, max_length=100)
    status: str = Field("pending", min_length=1, max_length=30)
    buyer_name: Optional[str] = Field(None, max_length=200)
    shipping_address: Optional[dict] = None
    shipping_fee: Optional[float] = Field(None, ge=0)
    platform_fee: Optional[float] = Field(None, ge=0)
    discount: Optional[float] = Field(None, ge=0)
    currency: str = Field(..., min_length=3, max_length=3)
    total: float = Field(..., gt=0)
    payment_status: Optional[str] = Field(None, max_length=30)
    payment_method: Optional[str] = Field(None, max_length=100)
    fulfillment_status: Optional[str] = Field(None, max_length=30)
    fulfillment_deadline_at: Optional[datetime] = None
    logistics_channel: Optional[str] = Field(None, max_length=100)
    ordered_at: datetime
    notes: Optional[str] = None
    items: list[ManualOrderItemCreate] = Field(..., min_length=1)


class ManualOrderImportRequest(BaseModel):
    rows: list[ManualOrderCreate] = Field(..., min_length=1)
    import_ref: Optional[str] = Field(None, max_length=120)
    source_file: Optional[str] = Field(None, max_length=255)

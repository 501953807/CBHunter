from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ShipmentCreate(BaseModel):
    order_id: str
    carrier: str
    shipping_method: Optional[str] = None
    tracking_number: Optional[str] = None
    actual_weight_g: Optional[float] = None
    volumetric_weight_g: Optional[float] = None
    shipping_cost: Optional[float] = None
    origin_address: Optional[dict] = None
    destination_address: Optional[dict] = None
    estimated_delivery_date: Optional[date] = None
    status: str = "draft"


class ShipmentUpdate(BaseModel):
    carrier: Optional[str] = None
    shipping_method: Optional[str] = None
    tracking_number: Optional[str] = None
    status: Optional[str] = None
    actual_weight_g: Optional[float] = None
    volumetric_weight_g: Optional[float] = None
    shipping_cost: Optional[float] = None
    origin_address: Optional[dict] = None
    destination_address: Optional[dict] = None
    estimated_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None


class ShipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    shipping_method: Optional[str] = None
    status: str
    actual_weight_g: Optional[float] = None
    volumetric_weight_g: Optional[float] = None
    shipping_cost: Optional[float] = None
    origin_address: Optional[dict] = None
    destination_address: Optional[dict] = None
    estimated_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    tracking_events: Optional[list] = None
    created_at: Optional[datetime] = None

class BatchShipmentCreate(BaseModel):
    order_ids: list[str]
    carrier: str
    shipping_method: Optional[str] = None

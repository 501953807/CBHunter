from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class ProductCreate(BaseModel):
    sku: Optional[str] = None
    name: str
    description: Optional[str] = None
    brand: Optional[str] = None
    category_id: Optional[str] = None
    cost_price: Optional[float] = None
    weight_g: Optional[float] = None
    dimensions: Optional[dict] = None
    attributes: Optional[dict] = None
    images: Optional[list] = None
    tags: Optional[list] = None
    status: str = "draft"
    notes: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    category_id: Optional[str] = None
    cost_price: Optional[float] = None
    weight_g: Optional[float] = None
    dimensions: Optional[dict] = None
    attributes: Optional[dict] = None
    images: Optional[list] = None
    tags: Optional[list] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ProductImageUrlImportRequest(BaseModel):
    image_url: str


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sku: str
    name: str
    description: Optional[str] = None
    brand: Optional[str] = None
    category_id: Optional[str] = None
    cost_price: Optional[float] = None
    weight_g: Optional[float] = None
    dimensions: Optional[dict] = None
    attributes: Optional[dict] = None
    images: Optional[list] = None
    tags: Optional[list] = None
    status: str
    notes: Optional[str] = None
    data_quality_flags: list[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    listings: list[dict] = Field(default_factory=list)

class ProductListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sku: str
    name: str
    brand: Optional[str] = None
    category_id: Optional[str] = None
    cost_price: Optional[float] = None
    weight_g: Optional[float] = None
    attributes: Optional[dict] = None
    status: str
    images: Optional[list] = None
    data_quality_flags: list[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class BatchPriceUpdate(BaseModel):
    product_ids: list[str]
    operation: str = Field(pattern=r"^(set|increase|decrease|markup)$")
    value: float = Field(ge=0)


class BatchStockUpdate(BaseModel):
    product_ids: list[str]
    operation: str = Field(pattern=r"^(set|increase|decrease)$")
    value: int = Field(ge=0)


class BatchPublishRequest(BaseModel):
    product_ids: list[str]
    platform_account_id: str
    template_id: Optional[str] = None

from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    platform: str
    category_id: Optional[str] = None
    template_data: dict
    is_default: bool = False


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    platform: Optional[str] = None
    category_id: Optional[str] = None
    template_data: Optional[dict] = None
    is_default: Optional[bool] = None


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    platform: str
    category_id: Optional[str] = None
    template_data: dict
    is_default: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class TemplatePreviewRequest(BaseModel):
    template_id: str
    product_id: str

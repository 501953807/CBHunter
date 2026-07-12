"""Schemas for generated content assets."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ContentAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asset_type: str
    original_name: Optional[str] = None
    mime_type: str
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[float] = None
    operation: str
    status: str
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

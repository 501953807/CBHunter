from pydantic import BaseModel, Field
from typing import Optional, Any

from app.schemas.evidence import SourceRef


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class ApiResponse(BaseModel):
    data: Optional[Any] = None
    meta: Optional[PaginationMeta] = None
    error: Optional[str] = None
    status: Optional[str] = None
    source_refs: list[SourceRef] = Field(default_factory=list)
    evidence_window: Optional[str] = None
    confidence_reason: Optional[str] = None
    data_gaps: list[str] = Field(default_factory=list)

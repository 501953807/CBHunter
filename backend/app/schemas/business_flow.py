"""Schemas for business-flow task ownership actions."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


FlowTaskStatus = Literal["open", "processing", "done", "cancelled"]
FlowTaskPriority = Literal["low", "normal", "high", "urgent"]


class BusinessFlowTaskItemRef(BaseModel):
    item_type: str = Field(min_length=1, max_length=60)
    item_id: str = Field(min_length=1, max_length=80)
    stage_key: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=500)
    route: str = Field(min_length=1, max_length=200)
    source_refs: list[dict] = Field(default_factory=list)
    last_gap: Optional[str] = Field(default=None, max_length=1000)


class BusinessFlowTaskBulkRequest(BaseModel):
    action: Literal["assign", "follow", "unfollow", "set_status", "set_priority"]
    items: list[BusinessFlowTaskItemRef] = Field(min_length=1, max_length=50)
    assigned_to: Optional[str] = Field(default=None, max_length=100)
    status: Optional[FlowTaskStatus] = None
    priority: Optional[FlowTaskPriority] = None
    note: Optional[str] = Field(default=None, max_length=1000)


class BusinessFlowTaskCommentRequest(BaseModel):
    comment: str = Field(min_length=1, max_length=1000)


class BusinessFlowTaskCompleteReviewRequest(BaseModel):
    outcome: str = Field(min_length=1, max_length=1000)
    impact_score: int = Field(ge=1, le=5)
    next_action: Optional[str] = Field(default=None, max_length=500)

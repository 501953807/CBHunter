"""Risk-control request schemas."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


RiskStatus = Literal["pending", "processing", "closed", "ignored"]


class RiskStateUpdateRequest(BaseModel):
    status: RiskStatus
    assigned_to: Optional[str] = Field(default=None, max_length=100)
    due_at: Optional[datetime] = None
    note: Optional[str] = Field(default=None, max_length=1000)

"""Audit log schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    username: str
    action: str
    resource_type: str
    resource_id: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime

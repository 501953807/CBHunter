from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional


class PlatformAccountCreate(BaseModel):
    platform: str
    account_name: str
    shop_id: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    settings: Optional[dict] = None


class PlatformAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    settings: Optional[dict] = None
    is_active: Optional[bool] = None


class PlatformAccountAuthorizationUpdate(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    token_scopes: Optional[list[str]] = None


class PlatformAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    platform: str
    account_name: str
    shop_id: Optional[str] = None
    settings: Optional[dict] = None
    is_active: bool
    last_sync_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

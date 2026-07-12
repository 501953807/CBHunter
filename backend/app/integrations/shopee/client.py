"""Shopee API client.

Real API integration is not implemented yet. The client refuses to authenticate
when credentials are missing instead of returning simulated commerce data.
"""

import logging
from datetime import datetime
from typing import Optional

from app.integrations.base import (
    BasePlatformClient, PlatformProduct, PlatformOrder, PlatformShipment, PlatformMetrics,
)
from app.utils.encryption import decrypt
from app.integrations.errors import PlatformOperationUnavailable
from app.integrations.product_normalizers import normalize_platform_product

logger = logging.getLogger(__name__)

class ShopeeClient(BasePlatformClient):
    async def authenticate(self) -> bool:
        try:
            api_key = decrypt(self.account.api_key_encrypted) if self.account.api_key_encrypted else ""
            if not api_key:
                logger.warning(f"Shopee account '{self.account.account_name}' has no API key configured")
                return False
            logger.warning("Shopee API credentials exist, but real Open API auth is not implemented")
            return False
        except Exception as e:
            logger.error(f"Shopee auth failed: {e}")
            return False

    async def refresh_token(self) -> bool:
        return await self.authenticate()

    async def get_products(self, page: int = 1, page_size: int = 50) -> tuple[list[PlatformProduct], int]:
        raise PlatformOperationUnavailable("shopee", "products")

    def normalize_product_payload(self, payload: dict) -> PlatformProduct:
        return normalize_platform_product("shopee", payload)

    async def get_orders(
        self, start_date: datetime, end_date: datetime,
        page: int = 1, page_size: int = 50,
        status_filter: Optional[list[str]] = None,
    ) -> tuple[list[PlatformOrder], int]:
        raise PlatformOperationUnavailable("shopee", "orders")

    async def get_shipments(
        self, start_date: datetime, end_date: datetime, page: int = 1
    ) -> tuple[list[PlatformShipment], int]:
        raise PlatformOperationUnavailable("shopee", "shipments")

    async def push_tracking(self, platform_order_id: str, tracking_number: str, carrier: str) -> bool:
        logger.info(f"Shopee push tracking: order={platform_order_id}, tracking={tracking_number}")
        raise PlatformOperationUnavailable("shopee", "tracking")

    async def get_shop_metrics(self, start_date: datetime, end_date: datetime) -> PlatformMetrics:
        raise PlatformOperationUnavailable("shopee", "metrics")

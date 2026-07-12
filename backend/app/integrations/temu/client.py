"""TEMU API client.

Real API integration is not implemented yet. The client refuses to authenticate
when credentials are missing instead of returning simulated commerce data.
"""

import logging
from app.integrations.base import BasePlatformClient
from app.integrations.errors import PlatformOperationUnavailable
from app.integrations.product_normalizers import normalize_platform_product
from app.utils.encryption import decrypt

logger = logging.getLogger(__name__)

class TEMUClient(BasePlatformClient):
    async def authenticate(self) -> bool:
        try:
            api_key = decrypt(self.account.api_key_encrypted) if self.account.api_key_encrypted else ""
            if not api_key:
                logger.warning(f"TEMU account '{self.account.account_name}' has no API key configured")
                return False
            logger.warning("TEMU credentials exist, but real Open API auth is not implemented")
            return False
        except Exception as e:
            logger.error(f"TEMU auth failed: {e}")
            return False

    async def refresh_token(self) -> bool:
        return await self.authenticate()

    async def get_products(self, page: int = 1, page_size: int = 50):
        raise PlatformOperationUnavailable("temu", "products")

    def normalize_product_payload(self, payload: dict):
        return normalize_platform_product("temu", payload)

    async def get_orders(self, start_date, end_date, page=1, page_size=50, status_filter=None):
        raise PlatformOperationUnavailable("temu", "orders")

    async def get_shipments(self, start_date, end_date, page=1):
        raise PlatformOperationUnavailable("temu", "shipments")

    async def push_tracking(self, platform_order_id, tracking_number, carrier):
        logger.info(f"TEMU push tracking: {platform_order_id} -> {tracking_number}")
        raise PlatformOperationUnavailable("temu", "tracking")

    async def get_shop_metrics(self, start_date, end_date):
        raise PlatformOperationUnavailable("temu", "metrics")

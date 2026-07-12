from typing import Optional
from app.integrations.base import BasePlatformClient


class PlatformClientFactory:
    _registry: dict[str, type[BasePlatformClient]] = {}

    @classmethod
    def register(cls, platform: str, client_class: type[BasePlatformClient]):
        cls._registry[platform] = client_class

    @classmethod
    def get_client(
        cls, platform: str, account, encryption_service
    ) -> Optional[BasePlatformClient]:
        client_class = cls._registry.get(platform)
        if not client_class:
            return None
        return client_class(account, encryption_service)


# Register platform clients
from app.integrations.shopee.client import ShopeeClient  # noqa: E402
from app.integrations.tiktok_shop.client import TikTokShopClient  # noqa: E402
from app.integrations.temu.client import TEMUClient  # noqa: E402

PlatformClientFactory.register("shopee", ShopeeClient)
PlatformClientFactory.register("tiktok", TikTokShopClient)
PlatformClientFactory.register("temu", TEMUClient)

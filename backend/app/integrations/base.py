from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.integrations.errors import PlatformOperationUnavailable


@dataclass
class PlatformProduct:
    platform_product_id: str
    title: str
    description: str
    price: Optional[float]
    stock: Optional[int]
    variations: list = field(default_factory=list)
    images: list = field(default_factory=list)
    status: Optional[str] = None
    category_id: Optional[str] = None
    platform_category_id: Optional[str] = None
    raw_data: dict = field(default_factory=dict)


@dataclass
class PlatformOrder:
    platform_order_id: str
    order_number: str
    status: str
    items: list = field(default_factory=list)
    buyer_name: Optional[str] = None
    buyer_notes: Optional[str] = None
    shipping_address: Optional[dict] = None
    subtotal: Optional[float] = None
    shipping_fee: Optional[float] = None
    platform_fee: Optional[float] = None
    discount: Optional[float] = None
    total: Optional[float] = None
    currency: Optional[str] = None
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    ordered_at: Optional[datetime] = None
    raw_data: dict = field(default_factory=dict)


@dataclass
class PlatformOrderItem:
    name: str
    sku: Optional[str] = None
    quantity: Optional[int] = None
    unit_price: Optional[float] = None
    platform_listing_id: Optional[str] = None


@dataclass
class PlatformShipment:
    tracking_number: str
    carrier: str = ""
    status: Optional[str] = None
    estimated_delivery: Optional[datetime] = None
    tracking_events: list = field(default_factory=list)
    raw_data: dict = field(default_factory=dict)


@dataclass
class PlatformMetrics:
    views: Optional[int] = None
    clicks: Optional[int] = None
    conversions: Optional[int] = None
    revenue: Optional[float] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    raw_data: dict = field(default_factory=dict)


@dataclass
class PlatformBillRecord:
    import_ref: str
    entry_type: str
    amount_rmb: float
    amount_original: Optional[float] = None
    currency: str = "CNY"
    order_id: Optional[str] = None
    sourcing_item_id: Optional[str] = None
    account_name: Optional[str] = None
    product_name: Optional[str] = None
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None
    raw_data: dict = field(default_factory=dict)


class BasePlatformClient(ABC):
    """Abstract base class for all platform API integrations."""

    def __init__(self, account, encryption_service):
        self.account = account
        self._encryption = encryption_service
        self._access_token = None

    @abstractmethod
    async def authenticate(self) -> bool:
        ...

    @abstractmethod
    async def refresh_token(self) -> bool:
        ...

    @abstractmethod
    async def get_products(
        self, page: int = 1, page_size: int = 50
    ) -> tuple[list[PlatformProduct], int]:
        ...

    @abstractmethod
    async def get_orders(
        self, start_date: datetime, end_date: datetime,
        page: int = 1, page_size: int = 50,
        status_filter: Optional[list[str]] = None,
    ) -> tuple[list[PlatformOrder], int]:
        ...

    @abstractmethod
    async def get_shipments(
        self, start_date: datetime, end_date: datetime, page: int = 1
    ) -> tuple[list[PlatformShipment], int]:
        ...

    @abstractmethod
    async def push_tracking(
        self, platform_order_id: str, tracking_number: str, carrier: str
    ) -> bool:
        ...

    @abstractmethod
    async def get_shop_metrics(
        self, start_date: datetime, end_date: datetime
    ) -> PlatformMetrics:
        ...

    async def get_finance_bills(
        self,
        start_date: datetime,
        end_date: datetime,
        page: int = 1,
        page_size: int = 100,
    ) -> tuple[list[PlatformBillRecord], int]:
        raise PlatformOperationUnavailable(self.platform_name, "finance_bills")

    async def get_trending_products(self, category: Optional[str] = None) -> list[PlatformProduct]:
        return []

    async def get_keyword_analysis(self, keyword: str) -> dict:
        return {
            "keyword": keyword,
            "search_volume": None,
            "competition_level": None,
            "status": "unavailable",
            "error": "Platform keyword analysis is not implemented",
        }

    async def publish_product(self, payload: dict) -> dict:
        raise PlatformOperationUnavailable(self.platform_name, "publish")

    async def sync_promotion_campaign(self, payload: dict) -> dict:
        raise PlatformOperationUnavailable(self.platform_name, "marketing")

    @property
    def platform_name(self) -> str:
        return self.__class__.__name__.replace("Client", "").lower()

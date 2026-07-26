from app.models.user import User
from app.models.platform_account import PlatformAccount
from app.models.category import Category
from app.models.product import Product
from app.models.product_object_model import ProductBaseVersion, ProductSkuVariant, PlatformFieldValidation
from app.models.platform_listing import PlatformListing
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.shipment import Shipment
from app.models.listing_template import ListingTemplate
from app.models.market_research import MarketResearch
from app.models.trending_product import TrendingProduct
from app.models.captured_trending_product import CapturedTrendingProduct
from app.models.supply_product import SupplyProduct
from app.models.competitor_product import CompetitorProduct
from app.models.ai_suggestion import AISuggestion
from app.models.analytics_snapshot import AnalyticsSnapshot
from app.models.sync_log import SyncLog
from app.models.sourcing_item import SourcingItem
from app.models.sourcing_supplier import SourcingSupplier
from app.models.trend_keyword import TrendKeyword
from app.models.captured_keyword import CapturedKeyword
from app.models.product_discovery import ProductDiscovery
from app.models.signal import Signal
from app.models.ai_provider import AIProviderDef
from app.models.fee_template import FeeTemplate
from app.models.exchange_rate import ExchangeRate
from app.models.sys_dict import SysDictItem
from app.models.system_config import SystemConfig
from app.models.task_run import TaskRun
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.models.inventory_alert import InventoryAlertRule, InventoryAlertLog
from app.models.report_subscription import ReportSubscription
from app.models.trend_seed import TrendSeed
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.content_asset import ContentAsset
from app.models.operation_record import OperationRecord
from app.models.promotion import PromotionCampaign, PromotionCampaignItem
from app.models.risk_event_state import RiskEventState
from app.models.business_flow_task import BusinessFlowTask
from app.models.access_control import Permission, Role, RolePermission, UserRole, StoreMember, UserIdentity
from app.models.billing import (
    SubscriptionPlan,
    PlanEntitlement,
    TenantSubscription,
    PaymentOrder,
    PaymentTransaction,
    PaymentCallback,
    QuotaUsage,
)

all_models = [
    User,
    PlatformAccount,
    Category,
    Product,
    ProductBaseVersion,
    ProductSkuVariant,
    PlatformFieldValidation,
    PlatformListing,
    Order,
    OrderItem,
    Shipment,
    ListingTemplate,
    MarketResearch,
    TrendingProduct,
    CapturedTrendingProduct,
    CompetitorProduct,
    AISuggestion,
    AnalyticsSnapshot,
    SyncLog,
    SourcingItem,
    TrendKeyword,
    CapturedKeyword,
    ProductDiscovery,
    SourcingSupplier,
    Signal,
    SysDictItem,
    AIProviderDef,
    FeeTemplate,
    ExchangeRate,
    SupplyProduct,
    SystemConfig,
    TaskRun,
    Notification,
    AuditLog,
    InventoryAlertRule,
    InventoryAlertLog,
    ReportSubscription,
    TrendSeed,
    FinanceLedgerEntry,
    ContentAsset,
    OperationRecord,
    PromotionCampaign,
    PromotionCampaignItem,
    RiskEventState,
    BusinessFlowTask,
    Permission,
    Role,
    RolePermission,
    UserRole,
    StoreMember,
    UserIdentity,
    SubscriptionPlan,
    PlanEntitlement,
    TenantSubscription,
    PaymentOrder,
    PaymentTransaction,
    PaymentCallback,
    QuotaUsage,
]

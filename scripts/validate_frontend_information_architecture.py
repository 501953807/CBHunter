#!/usr/bin/env python3
"""Validate module navigation and settings information architecture."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SRC = ROOT / "frontend/src"
INDEX_CSS = (ROOT / "frontend/src/index.css").read_text(encoding="utf-8")
NATIVE_CONFIRM_ALLOWLIST = {
    "frontend/src/components/ui/ConfirmDialog.tsx",
}
MODULE_SUBNAV = (ROOT / "frontend/src/components/layout/ModuleSubnav.tsx").read_text(encoding="utf-8")
TABS_COMPONENT = (ROOT / "frontend/src/components/ui/Tabs.tsx").read_text(encoding="utf-8")
BADGE_COMPONENT = (ROOT / "frontend/src/components/ui/Badge.tsx").read_text(encoding="utf-8")
DATA_TABLE = (ROOT / "frontend/src/components/shared/DataTable.tsx").read_text(encoding="utf-8")
SIDEBAR = (ROOT / "frontend/src/components/layout/Sidebar.tsx").read_text(encoding="utf-8")
NAVIGATION = (ROOT / "frontend/src/components/layout/navigation.ts").read_text(encoding="utf-8")
ROUTE_META = (ROOT / "frontend/src/components/layout/routeMeta.ts").read_text(encoding="utf-8")
SETTINGS_WORKSPACE = (ROOT / "frontend/src/features/settings/SettingsWorkspace.tsx").read_text(encoding="utf-8")
SETTINGS_ACCOUNT_PANELS = (ROOT / "frontend/src/features/settings/SettingsAccountPanels.tsx").read_text(encoding="utf-8")
SETTINGS_SYSTEM_PANELS = (ROOT / "frontend/src/features/settings/SettingsSystemPanels.tsx").read_text(encoding="utf-8")
SETTINGS_ACCESS_PANEL = (ROOT / "frontend/src/features/settings/SettingsAccessPanel.tsx").read_text(encoding="utf-8")
SEED_MANAGER_TAB = (ROOT / "frontend/src/features/settings/SeedManagerTab.tsx").read_text(encoding="utf-8")
HEADER = (ROOT / "frontend/src/components/layout/Header.tsx").read_text(encoding="utf-8")
OPERATIONS_WORKSPACE = (ROOT / "frontend/src/features/operations/OperationsWorkspace.tsx").read_text(encoding="utf-8")
SCOUT_WORKSPACE = (ROOT / "frontend/src/features/scout-sources/ScoutSourcesWorkspace.tsx").read_text(encoding="utf-8")
SCOUT_SOURCES_VIEW = (ROOT / "frontend/src/features/scout-sources/ScoutSourcesView.tsx").read_text(encoding="utf-8")
SIGNAL_FUNNEL_OVERVIEW = (ROOT / "frontend/src/features/scout-sources/SignalFunnelOverview.tsx").read_text(encoding="utf-8")
SCOUT_STAGE_RAIL = (ROOT / "frontend/src/features/scout-sources/ScoutStageRail.tsx").read_text(encoding="utf-8")
CONTENT_STAGE_RAIL_PATH = ROOT / "frontend/src/features/content-planner/ContentListingStageRail.tsx"
CONTENT_STAGE_RAIL = CONTENT_STAGE_RAIL_PATH.read_text(encoding="utf-8") if CONTENT_STAGE_RAIL_PATH.exists() else ""
SELECTION_PIPELINE = (ROOT / "frontend/src/components/shared/SelectionBusinessPipeline.tsx").read_text(encoding="utf-8")
BUSINESS_FLOW_V2 = (ROOT / "frontend/src/features/business-flow/BusinessFlowV2Board.tsx").read_text(encoding="utf-8")
BUSINESS_FLOW_WORKSPACE = (ROOT / "frontend/src/features/business-flow/BusinessFlowWorkspace.tsx").read_text(encoding="utf-8")
BUSINESS_FLOW_COMMAND_BOARD = (ROOT / "frontend/src/features/business-flow/BusinessFlowCommandBoard.tsx").read_text(encoding="utf-8")
BUSINESS_FLOW_CONTEXT_RAIL = (ROOT / "frontend/src/features/business-flow/BusinessFlowContextRail.tsx").read_text(encoding="utf-8")
BUSINESS_FLOW_ROUTES = (ROOT / "frontend/src/features/business-flow/businessFlowRoutes.ts").read_text(encoding="utf-8")
COMPARISON_RANGE_UTIL = (ROOT / "frontend/src/utils/comparisonRange.ts").read_text(encoding="utf-8")
COMPARISON_RANGE_CARDS = (ROOT / "frontend/src/components/shared/ComparisonRangeCards.tsx").read_text(encoding="utf-8")
COMMAND_INSIGHT_STRIP = (ROOT / "frontend/src/components/shared/CommandInsightStrip.tsx").read_text(encoding="utf-8")
METRIC_STACK_BAR = (ROOT / "frontend/src/components/shared/MetricStackBar.tsx").read_text(encoding="utf-8")
STORE_CONTEXT_BANNER = (ROOT / "frontend/src/components/shared/StoreContextBanner.tsx").read_text(encoding="utf-8")
RISK_CONTROL_WORKSPACE = (ROOT / "frontend/src/features/risk-control/RiskControlWorkspace.tsx").read_text(encoding="utf-8")
RISK_SIGNAL_BOARD = (ROOT / "frontend/src/features/risk-control/RiskSignalBoard.tsx").read_text(encoding="utf-8")
RISK_STORE_COMMAND_BOARD = (ROOT / "frontend/src/features/risk-control/RiskStoreCommandBoard.tsx").read_text(encoding="utf-8")
RISK_EVIDENCE_PANEL = (ROOT / "frontend/src/features/risk-control/RiskEvidencePanel.tsx").read_text(encoding="utf-8")
RISK_ACTION_PANEL = (ROOT / "frontend/src/features/risk-control/RiskActionPanel.tsx").read_text(encoding="utf-8")
RISK_CONTROL_API = (ROOT / "frontend/src/api/riskControl.ts").read_text(encoding="utf-8")
COCKPIT_WORKSPACE = (ROOT / "frontend/src/features/cockpit/CockpitWorkspace.tsx").read_text(encoding="utf-8")
COCKPIT_CENTER_SUMMARY = (ROOT / "frontend/src/features/cockpit/CockpitCenterSummaryPanels.tsx").read_text(encoding="utf-8")
COCKPIT_STORE_COMMAND_BOARD = (ROOT / "frontend/src/features/cockpit/CockpitStoreCommandBoard.tsx").read_text(encoding="utf-8")
COCKPIT_SCOPE_FILTERS = (ROOT / "frontend/src/features/cockpit/CockpitScopeFilters.tsx").read_text(encoding="utf-8")
COCKPIT_SIDEBAR = (ROOT / "frontend/src/features/cockpit/CockpitSidebar.tsx").read_text(encoding="utf-8")
COCKPIT_TYPES = (ROOT / "frontend/src/types/cockpit.ts").read_text(encoding="utf-8")
COCKPIT_COMMAND_WIDGETS = (ROOT / "frontend/src/features/cockpit/CockpitCommandWidgets.tsx").read_text(encoding="utf-8")
COCKPIT_METRIC_STRIP = (ROOT / "frontend/src/features/cockpit/CockpitMetricStrip.tsx").read_text(encoding="utf-8")
TREND_DISCOVERY_WORKSPACE = (ROOT / "frontend/src/features/trend-discovery/TrendDiscoveryWorkspace.tsx").read_text(encoding="utf-8")
RECOMMENDATION_EVIDENCE_PANEL = (ROOT / "frontend/src/features/trend-discovery/RecommendationEvidencePanel.tsx").read_text(encoding="utf-8")
RECOMMENDER_READINESS_PANEL = (ROOT / "frontend/src/features/trend-discovery/RecommenderReadinessPanel.tsx").read_text(encoding="utf-8")
TREND_PIPELINE_UTILS = (ROOT / "frontend/src/features/trend-discovery/TrendPipelineUtils.ts").read_text(encoding="utf-8")
TREND_DISCOVERY_FILES = "\n".join(
    path.read_text(encoding="utf-8")
    for path in (ROOT / "frontend/src/features/trend-discovery").glob("*.tsx")
)
PRODUCT_SELECTION_WORKSPACE = (ROOT / "frontend/src/features/product-selection/ProductSelectionWorkspace.tsx").read_text(encoding="utf-8")
PRODUCT_SELECTION_CORE_TABS = (ROOT / "frontend/src/features/product-selection/ProductSelectionCoreTabs.tsx").read_text(encoding="utf-8")
DECISION_CANDIDATE_CONTEXT = (ROOT / "frontend/src/features/product-selection/DecisionCandidateContext.tsx").read_text(encoding="utf-8")
PRICING_ITEM_SELECTOR = (ROOT / "frontend/src/features/pricing/PricingItemSelector.tsx").read_text(encoding="utf-8")
SMART_PRICING_PAGE = (ROOT / "frontend/src/pages/SmartPricingPage.tsx").read_text(encoding="utf-8")
PRICING_API = (ROOT / "frontend/src/api/pricing.ts").read_text(encoding="utf-8")
CONTENT_MEDIA_STUDIO = (ROOT / "frontend/src/features/content-planner/ContentMediaStudio.tsx").read_text(encoding="utf-8")
SELLER_IMAGE_EDITOR_WORKBENCH = (ROOT / "frontend/src/features/content-planner/SellerImageEditorWorkbench.tsx").read_text(encoding="utf-8")
CONTENT_TITLE_GENERATOR = (ROOT / "frontend/src/features/content-planner/ContentTitleGenerator.tsx").read_text(encoding="utf-8")
SELLER_PLATFORM_LISTING_EDITOR = (ROOT / "frontend/src/features/content-planner/SellerPlatformListingEditorPanel.tsx").read_text(encoding="utf-8")
SELLER_PLATFORM_LISTING_EDITOR_UTILS = (ROOT / "frontend/src/features/content-planner/SellerPlatformListingEditorUtils.ts").read_text(encoding="utf-8")
CONTENT_PLANNER_WORKSPACE = (ROOT / "frontend/src/features/content-planner/ContentPlannerWorkspace.tsx").read_text(encoding="utf-8")
LISTING_OBJECT_SCOPE_MAP = (ROOT / "frontend/src/features/content-planner/ListingObjectScopeMap.tsx").read_text(encoding="utf-8")
LISTING_STORE_OVERRIDE_EDITOR_PATH = ROOT / "frontend/src/features/content-planner/ListingStoreOverrideEditor.tsx"
LISTING_STORE_OVERRIDE_EDITOR = LISTING_STORE_OVERRIDE_EDITOR_PATH.read_text(encoding="utf-8") if LISTING_STORE_OVERRIDE_EDITOR_PATH.exists() else ""
LISTING_UNIFIED_EDITOR_SECTIONS = (ROOT / "frontend/src/features/content-planner/ListingUnifiedEditorSections.tsx").read_text(encoding="utf-8")
LISTING_SPECIFICATION_EDITOR = (ROOT / "frontend/src/features/content-planner/ListingSpecificationEditor.tsx").read_text(encoding="utf-8")
CONTENT_PUBLISH_GUIDE = (ROOT / "frontend/src/features/content-planner/ContentPublishGuide.tsx").read_text(encoding="utf-8")
CONTENT_PRODUCT_QUEUE = (ROOT / "frontend/src/features/content-planner/ContentProductQueue.tsx").read_text(encoding="utf-8")
CONTENT_TASK_MATRIX = (ROOT / "frontend/src/features/content-planner/ContentTaskMatrix.tsx").read_text(encoding="utf-8")
LISTING_TEMPLATES_WORKSPACE = (ROOT / "frontend/src/features/listing-templates/ListingTemplatesWorkspace.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_PREVIEW = (ROOT / "frontend/src/features/batch-publish/BatchPublishPreviewStep.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_OVERRIDE_PREVIEW_PATH = ROOT / "frontend/src/features/batch-publish/StoreOverridePreviewPanel.tsx"
BATCH_PUBLISH_OVERRIDE_PREVIEW = BATCH_PUBLISH_OVERRIDE_PREVIEW_PATH.read_text(encoding="utf-8") if BATCH_PUBLISH_OVERRIDE_PREVIEW_PATH.exists() else ""
BATCH_PUBLISH_QUEUE = (ROOT / "frontend/src/features/batch-publish/ListingDraftQueue.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_COMPLETENESS = (ROOT / "frontend/src/features/batch-publish/ListingCompletenessPanel.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_RESULT = (ROOT / "frontend/src/features/batch-publish/BatchPublishResultStep.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_WORKSPACE = (ROOT / "frontend/src/features/batch-publish/BatchPublishWorkspace.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_SELECT = (ROOT / "frontend/src/features/batch-publish/BatchPublishSelectStep.tsx").read_text(encoding="utf-8")
PRODUCT_EDIT_PAGE = (ROOT / "frontend/src/pages/ProductEditPage.tsx").read_text(encoding="utf-8")
PRODUCT_DETAIL_TABS = (ROOT / "frontend/src/features/products/ProductDetailTabs.tsx").read_text(encoding="utf-8")
PRODUCT_LISTING_EDITOR_CHROME = (ROOT / "frontend/src/features/products/ProductListingEditorChrome.tsx").read_text(encoding="utf-8")
PRODUCT_LISTING_EDITOR_CONTENT = PRODUCT_DETAIL_TABS + PRODUCT_LISTING_EDITOR_CHROME
PRODUCT_IMAGES_PANEL = (ROOT / "frontend/src/features/products/ProductImagesPanel.tsx").read_text(encoding="utf-8")
PLATFORM_FIELD_GROUPS = (ROOT / "frontend/src/components/shared/PlatformFieldGroups.tsx").read_text(encoding="utf-8")
PLATFORM_STORE_PRODUCTS_PANEL_PATH = ROOT / "frontend/src/features/products/PlatformStoreProductsPanel.tsx"
PLATFORM_STORE_PRODUCTS_PANEL = PLATFORM_STORE_PRODUCTS_PANEL_PATH.read_text(encoding="utf-8") if PLATFORM_STORE_PRODUCTS_PANEL_PATH.exists() else ""
PRODUCT_PLATFORM_ATTRIBUTES_PANEL = (ROOT / "frontend/src/features/products/ProductPlatformAttributesPanel.tsx").read_text(encoding="utf-8")
PRODUCT_LIST_PAGE = (ROOT / "frontend/src/pages/ProductListPage.tsx").read_text(encoding="utf-8")
PRODUCT_BULK_TOOLBAR = (ROOT / "frontend/src/features/products/ProductBulkToolbar.tsx").read_text(encoding="utf-8")
ORDER_LIST_PAGE = (ROOT / "frontend/src/pages/OrderListPage.tsx").read_text(encoding="utf-8")
ORDER_DETAIL_PAGE = (ROOT / "frontend/src/pages/OrderDetailPage.tsx").read_text(encoding="utf-8")
SHIPMENT_LIST_PAGE = (ROOT / "frontend/src/pages/ShipmentListPage.tsx").read_text(encoding="utf-8")
SHIPMENT_DETAIL_PAGE = (ROOT / "frontend/src/pages/ShipmentDetailPage.tsx").read_text(encoding="utf-8")
AFTER_SALES_PAGE = (ROOT / "frontend/src/pages/AfterSalesPage.tsx").read_text(encoding="utf-8")
ORDER_SERVICE = (ROOT / "backend/app/services/order_service.py").read_text(encoding="utf-8")
ORDER_API = (ROOT / "backend/app/api/v1/orders.py").read_text(encoding="utf-8")
SHIPMENT_SERVICE = (ROOT / "backend/app/services/shipment_service.py").read_text(encoding="utf-8")
SYNC_SERVICE_BACKEND = (ROOT / "backend/app/services/sync_service.py").read_text(encoding="utf-8")
SYNC_BACKEND_API = (ROOT / "backend/app/api/v1/sync.py").read_text(encoding="utf-8")
ORDERS_API = (ROOT / "frontend/src/api/orders.ts").read_text(encoding="utf-8")
ORDER_TYPES = (ROOT / "frontend/src/types/order.ts").read_text(encoding="utf-8")
SHIPMENTS_API = (ROOT / "frontend/src/api/shipments.ts").read_text(encoding="utf-8")
USE_ORDERS_HOOK = (ROOT / "frontend/src/hooks/useOrders.ts").read_text(encoding="utf-8")
USE_SYNC_HOOK = (ROOT / "frontend/src/hooks/useSync.ts").read_text(encoding="utf-8")
USE_CONFIG_HOOK = (ROOT / "frontend/src/hooks/useConfig.ts").read_text(encoding="utf-8")
CONFIG_API = (ROOT / "frontend/src/api/config.ts").read_text(encoding="utf-8")
CONFIG_SERVICE = (ROOT / "backend/app/services/config_service.py").read_text(encoding="utf-8")
RISK_CONTROL_SERVICE = (ROOT / "backend/app/services/risk_control_service.py").read_text(encoding="utf-8")
RISK_CONTROL_SOURCE_SUMMARY_SERVICE = (ROOT / "backend/app/services/risk_control_source_summary_service.py").read_text(encoding="utf-8")
RISK_CONTROL_SALES_RISK_SERVICE = (ROOT / "backend/app/services/risk_control_sales_risk_service.py").read_text(encoding="utf-8")
FINANCE_PAGE = (ROOT / "frontend/src/pages/FinancePage.tsx").read_text(encoding="utf-8")
FINANCE_API = (ROOT / "frontend/src/api/finance.ts").read_text(encoding="utf-8")
FINANCE_LEDGER_PANEL = (ROOT / "frontend/src/features/finance/FinanceLedgerPanel.tsx").read_text(encoding="utf-8")
FINANCE_SERVICE = (ROOT / "backend/app/services/finance_service.py").read_text(encoding="utf-8")
FINANCE_SCHEMA = (ROOT / "backend/app/schemas/finance.py").read_text(encoding="utf-8")
FINANCE_BACKEND_API = (ROOT / "backend/app/api/v1/finance.py").read_text(encoding="utf-8")
REPORT_SERVICE = (ROOT / "backend/app/services/report_service.py").read_text(encoding="utf-8")
REPORT_DISPLAY = (ROOT / "frontend/src/features/reports/ReportDisplay.tsx").read_text(encoding="utf-8")
REPORT_PANELS = (ROOT / "frontend/src/features/reports/ReportsPanels.tsx").read_text(encoding="utf-8")
REPORT_TYPES = (ROOT / "frontend/src/types/reports.ts").read_text(encoding="utf-8")
GROWTH_ENGINE_PAGE = (ROOT / "frontend/src/pages/GrowthEnginePage.tsx").read_text(encoding="utf-8")
AI_SUGGESTIONS_PAGE = (ROOT / "frontend/src/pages/AISuggestionsPage.tsx").read_text(encoding="utf-8")
OPERATIONS_WORKSPACE = (ROOT / "frontend/src/features/operations/OperationsWorkspace.tsx").read_text(encoding="utf-8")
COMPETITOR_MONITOR_PAGE = (ROOT / "frontend/src/pages/CompetitorMonitorPage.tsx").read_text(encoding="utf-8")
AUDIT_LOG_TAB = (ROOT / "frontend/src/pages/settings/AuditLogTab.tsx").read_text(encoding="utf-8")
INVENTORY_ALERT_WORKSPACE = (ROOT / "frontend/src/features/inventory-alerts/InventoryAlertWorkspace.tsx").read_text(encoding="utf-8")
INVENTORY_ALERT_PANELS = (ROOT / "frontend/src/features/inventory-alerts/InventoryAlertPanels.tsx").read_text(encoding="utf-8")
INVENTORY_ALERT_API = (ROOT / "frontend/src/api/inventoryAlerts.ts").read_text(encoding="utf-8")
INVENTORY_ALERT_HOOKS = (ROOT / "frontend/src/hooks/useInventoryAlerts.ts").read_text(encoding="utf-8")
SYNC_HOOKS = (ROOT / "frontend/src/hooks/useSync.ts").read_text(encoding="utf-8")
INVENTORY_ALERT_BACKEND_API = (ROOT / "backend/app/api/v1/inventory_alerts.py").read_text(encoding="utf-8")
INVENTORY_RISK_ACTION_SERVICE = (ROOT / "backend/app/services/inventory_risk_action_service.py").read_text(encoding="utf-8")
SETTINGS_BILLING_PANEL = (ROOT / "frontend/src/features/settings/SettingsBillingPanel.tsx").read_text(encoding="utf-8")
OPERATIONS_API = (ROOT / "frontend/src/api/operations.ts").read_text(encoding="utf-8")
PROMOTIONS_PAGE = (ROOT / "frontend/src/pages/PromotionsPage.tsx").read_text(encoding="utf-8")
PROMOTIONS_API = (ROOT / "frontend/src/api/promotions.ts").read_text(encoding="utf-8")
PROMOTIONS_BACKEND_API = (ROOT / "backend/app/api/v1/promotions.py").read_text(encoding="utf-8")
PROMOTION_SERVICE = (ROOT / "backend/app/services/promotion_service.py").read_text(encoding="utf-8")
PROMOTION_MODEL = (ROOT / "backend/app/models/promotion.py").read_text(encoding="utf-8")
PRODUCT_NORMALIZERS = (ROOT / "backend/app/integrations/product_normalizers.py").read_text(encoding="utf-8")
SHOPEE_CLIENT = (ROOT / "backend/app/integrations/shopee/client.py").read_text(encoding="utf-8")
TIKTOK_CLIENT = (ROOT / "backend/app/integrations/tiktok_shop/client.py").read_text(encoding="utf-8")
TEMU_CLIENT = (ROOT / "backend/app/integrations/temu/client.py").read_text(encoding="utf-8")
PRODUCT_SELLER_WORKBENCH = (ROOT / "frontend/src/features/products/ProductSellerWorkbench.tsx").read_text(encoding="utf-8")
PRODUCTS_API = (ROOT / "frontend/src/api/products.ts").read_text(encoding="utf-8")
SYNC_API = (ROOT / "frontend/src/api/sync.ts").read_text(encoding="utf-8")
LISTING_API = (ROOT / "frontend/src/api/listing.ts").read_text(encoding="utf-8")
BATCH_PUBLISH_SERVICE = (ROOT / "backend/app/services/batch_publish_service.py").read_text(encoding="utf-8")
LISTING_STORE_OVERRIDE_SERVICE = (ROOT / "backend/app/services/listing_store_override_service.py").read_text(encoding="utf-8")
PLATFORMS_API = (ROOT / "frontend/src/api/platforms.ts").read_text(encoding="utf-8")
PLATFORM_SETTINGS_PAGE = (ROOT / "frontend/src/pages/PlatformSettingsPage.tsx").read_text(encoding="utf-8")
PROFESSIONAL_WORKSPACE_FRAME_PATH = ROOT / "frontend/src/components/shared/ProfessionalWorkspaceFrame.tsx"
PROFESSIONAL_WORKSPACE_FRAME = PROFESSIONAL_WORKSPACE_FRAME_PATH.read_text(encoding="utf-8") if PROFESSIONAL_WORKSPACE_FRAME_PATH.exists() else ""
COMMAND_CENTER_FRAME_PATH = ROOT / "frontend/src/components/shared/CommandCenterFrame.tsx"
COMMAND_CENTER_FRAME = COMMAND_CENTER_FRAME_PATH.read_text(encoding="utf-8") if COMMAND_CENTER_FRAME_PATH.exists() else ""
BUSINESS_OBJECT_ACTION_BAR_PATH = ROOT / "frontend/src/components/shared/BusinessObjectActionBar.tsx"
BUSINESS_OBJECT_ACTION_BAR = BUSINESS_OBJECT_ACTION_BAR_PATH.read_text(encoding="utf-8") if BUSINESS_OBJECT_ACTION_BAR_PATH.exists() else ""
IMPLEMENTATION_PLAN = (ROOT / "docs/03_CBHunter_V5.0实施任务总表.md").read_text(encoding="utf-8")
UNIFIED_FIELD_DICTIONARY = (ROOT / "backend/app/data/default_unified_field_dictionary.json").read_text(encoding="utf-8")


def native_confirm_usages() -> list[str]:
    confirm_pattern = re.compile(r"(?<![A-Za-z0-9_$\.])confirm\s*\(|window\.confirm\s*\(")
    usages: list[str] = []
    for path in sorted(FRONTEND_SRC.rglob("*.ts")) + sorted(FRONTEND_SRC.rglob("*.tsx")):
        rel = path.relative_to(ROOT).as_posix()
        if rel in NATIVE_CONFIRM_ALLOWLIST:
            continue
        text = path.read_text(encoding="utf-8")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if confirm_pattern.search(line):
                usages.append(f"{rel}:{lineno}")
    return usages


def validate() -> list[str]:
    errors: list[str] = []
    for root_name in ("frontend/src", "backend/app"):
        for path in (ROOT / root_name).rglob("*"):
            if path.suffix not in {".ts", ".tsx", ".py"}:
                continue
            content = path.read_text(encoding="utf-8")
            if "证据" in content:
                errors.append(f"user-facing Chinese terminology must use data/source/material wording instead of evidence wording: {path.relative_to(ROOT)}")

    ui_scheme_section = IMPLEMENTATION_PLAN.split("#### 6.7.7.1 三套可实施 UI 页面方案", 1)[-1].split("### 6.7.8 新增实施任务", 1)[0]
    for required in (
        "6.7.7.1 三套可实施 UI 页面方案",
        "UI-V4-A 专业 SaaS 卖家后台",
        "UI-V4-B 跨境经营控制塔",
        "UI-V4-C 现代电商运营工作台",
        "经营指挥台页面结构",
        "商品 Listing 工作台页面结构",
        "订单详情/财务拆解页面结构",
        "页面对象",
        "组件摆放",
        "业务链表达",
        "验收口径",
    ):
        if required not in IMPLEMENTATION_PLAN:
            errors.append(f"UI-V4-P0-01 implementation plan must keep executable design detail: {required}")
    for scheme in ("UI-V4-A", "UI-V4-B", "UI-V4-C"):
        for detail in ("页面对象", "组件摆放", "业务链表达", "验收口径"):
            if f"{scheme} {detail}" not in ui_scheme_section:
                errors.append(f"UI-V4-P0-01 scheme must explicitly define {scheme} {detail}")
    for required in ("--color-command-bg", "--color-command-panel", "--color-command-accent", "--color-workspace-chrome", "--shadow-command"):
        if required not in INDEX_CSS:
            errors.append(f"mixed UI scheme tokens must be declared in index.css: {required}")
    for required in ("aria-label=\"三大中枢控制塔框架\"", "data-ui-scheme=\"hybrid-command-center\"", "command-center-shell", "command-center-hero"):
        if required not in COMMAND_CENTER_FRAME:
            errors.append(f"command center frame must implement hybrid B/C shell: {required}")
    for page_name, page_content in (
        ("operating cockpit", COCKPIT_WORKSPACE),
        ("risk control", RISK_CONTROL_WORKSPACE),
        ("business monitor", BUSINESS_FLOW_WORKSPACE),
    ):
        if "CommandCenterFrame" not in page_content:
            errors.append(f"{page_name} must use CommandCenterFrame for the selected hybrid command-center shell")
    if "data-ui-scheme=\"professional-saas\"" not in PROFESSIONAL_WORKSPACE_FRAME:
        errors.append("professional workspace frame must explicitly mark the A-style professional SaaS shell")
    for required in ("professional-tabbar", "professional-table", "professional-context-rail", "professional-status-chip"):
        if required not in INDEX_CSS:
            errors.append(f"professional SaaS workspaces must share density/style utility: {required}")
    if "professional-tabbar" not in TABS_COMPONENT or "data-ui-scheme=\"professional-tabs\"" not in TABS_COMPONENT:
        errors.append("shared Tabs component must use the professional tabbar scheme")
    if "professional-tabbar" not in MODULE_SUBNAV or "data-ui-scheme=\"professional-tabs\"" not in MODULE_SUBNAV:
        errors.append("module subnav must use the same professional tabbar scheme as page tabs")
    for required in ("6.7.9 V5 结构性重构硬约束", "DASH-V5-P0-01", "RISK-V5-P0-01", "FLOW-V5-P0-01", "SCOUT-V5-P0-01", "LISTING-V5-P0-01", "PRODUCT-V5-P0-01"):
        if required not in IMPLEMENTATION_PLAN:
            errors.append(f"V5 structural remediation must stay in the master implementation plan: {required}")
    if "professional-status-chip" not in BADGE_COMPONENT or "data-status-variant" not in BADGE_COMPONENT:
        errors.append("Badge must expose a shared professional status chip class and data-status-variant")
    for page_name, page_content in (
        ("product seller workbench", PRODUCT_SELLER_WORKBENCH),
        ("content task matrix", CONTENT_TASK_MATRIX),
        ("platform store products", PLATFORM_STORE_PRODUCTS_PANEL),
        ("batch publish select", BATCH_PUBLISH_SELECT),
        ("shared data table", DATA_TABLE),
        ("finance ledger", FINANCE_LEDGER_PANEL),
        ("operations workspace", OPERATIONS_WORKSPACE),
        ("competitor monitor", COMPETITOR_MONITOR_PAGE),
        ("audit log", AUDIT_LOG_TAB),
        ("inventory alerts", INVENTORY_ALERT_PANELS),
        ("settings account", SETTINGS_ACCOUNT_PANELS),
        ("settings billing", SETTINGS_BILLING_PANEL),
    ):
        if "professional-table" not in page_content:
            errors.append(f"{page_name} must use the shared professional table density class")
    for page_name, page_content in (
        ("product seller workbench", PRODUCT_SELLER_WORKBENCH),
        ("content task matrix", CONTENT_TASK_MATRIX),
    ):
        if "professional-context-rail" not in page_content:
            errors.append(f"{page_name} must mark its right-side diagnostic panel as professional-context-rail")

    native_confirm = native_confirm_usages()
    if native_confirm:
        errors.append(
            "frontend business code must use ConfirmDialog/useConfirm instead of browser confirm(): "
            + ", ".join(native_confirm[:20])
        )

    if "模块功能" in MODULE_SUBNAV:
        errors.append("module secondary navigation must not render the '模块功能' card header")
    if "rounded-lg border" in MODULE_SUBNAV and "shadow-[var(--shadow-sm)]" in MODULE_SUBNAV:
        errors.append("module secondary navigation must use lightweight tabs, not card-like buttons")
    if "item.note" in MODULE_SUBNAV:
        errors.append("module tabs must not render secondary explanatory notes like cards")
    if "label: '设置中心'" in MODULE_SUBNAV:
        errors.append("settings must own its subnavigation inside the settings page to avoid duplicate navigation")
    scout_nav_section = MODULE_SUBNAV.split("label: '品源与选品'", 1)[-1].split("label: '商品与库存'", 1)[0]
    for required in ("label: '信号捕获'", "label: '候选验证'", "label: '选品决策'"):
        if required not in scout_nav_section:
            errors.append(f"scout module tabs must use the V5 three-stage boundary: {required}")
    for forbidden in ("关键词雷达", "供应交叉验证", "内容制作", "定价校验", "平台刊登"):
        if forbidden in scout_nav_section:
            errors.append(f"scout module top tabs must not expose tool pages or downstream stages: {forbidden}")
    if "section.label === '品源与选品'" not in MODULE_SUBNAV or "return null" not in MODULE_SUBNAV:
        errors.append("scout module must not render the generic top ModuleSubnav; its three stages live in the compact ScoutStageRail")
    for required in ("aria-label=\"品源三阶段侧边导航\"", "信号捕获", "候选验证", "选品决策", "先发散，再收敛，最后决策"):
        if required not in SCOUT_STAGE_RAIL:
            errors.append(f"scout stage rail must express the compact three-stage workflow: {required}")
    for required in ("data-navigation-style=\"floating-stage-rail\"", "data-ui=\"draggable-stage-rail\"", "data-draggable=\"true\"", "data-collapsible=\"true\"", "onPointerDown", "setCollapsed", "fixed", "z-40", "pointer-events-none", "pointer-events-auto"):
        if required not in SCOUT_STAGE_RAIL:
            errors.append(f"scout stage rail must be a draggable collapsible floating side rail: {required}")
    if "right-4 top-[148px]" in SCOUT_STAGE_RAIL:
        errors.append("scout stage rail must not be hard-fixed to the right edge; it must be draggable")
    if "xl:sticky" in SCOUT_STAGE_RAIL or "sm:grid-cols-3" in SCOUT_STAGE_RAIL:
        errors.append("scout stage rail must not regress to an inline sticky/horizontal card block")
    for forbidden in ("内容制作", "定价校验", "平台刊登"):
        if forbidden in SCOUT_STAGE_RAIL:
            errors.append(f"scout stage rail must not include downstream content/listing stages: {forbidden}")
    for page_name, page_content in (
        ("scout signal capture", f"{SCOUT_WORKSPACE}\n{SCOUT_SOURCES_VIEW}"),
        ("candidate validation", TREND_DISCOVERY_WORKSPACE),
        ("selection decision", PRODUCT_SELECTION_WORKSPACE),
    ):
        if "SelectionBusinessPipeline" in page_content:
            errors.append(f"{page_name} must not render the cross-module selection-to-listing pipeline inside 品源与选品")
        if "ScoutStageRail" not in page_content:
            errors.append(f"{page_name} must use ScoutStageRail instead of a wide top workflow strip")
        if "scout-workflow-page" not in page_content or "scout-workflow-main" not in page_content:
            errors.append(f"{page_name} must reserve a stable main workspace and floating rail safe zone")
        if "xl:grid-cols-[168px_minmax(0,1fr)]" in page_content:
            errors.append(f"{page_name} must not reserve the old 168px navigation grid column after ScoutStageRail became fixed")
    for required in (
        "SignalLayerPrimaryTabs",
        "aria-label=\"四层信号主入口 Tabs\"",
        "data-ui-scheme=\"signal-command-tabs\"",
        "signal-command-panel",
        "signal-layer-tab",
        "signal-layer-orb",
        "signal-layer-chip",
        "signal-detail-shell",
        "signal-detail-main",
        "signal-detail-side",
        "LayerWorkGuide",
        "四层数据就绪度",
        "社交文娱影响",
        "流行趋势",
        "销售平台",
        "供应渠道",
        "核心信号主入口",
        "当前详情层",
    ):
        if required not in SCOUT_SOURCES_VIEW:
            errors.append(f"scout signal capture must put four signal layers in top primary tabs: {required}")
    for required in ("scout-workflow-page", "scout-workflow-main", "signal-command-panel", "signal-layer-tab", "signal-layer-orb", "signal-layer-chip", "signal-detail-shell", "signal-guide-card", "signal-readiness-stack", "signal-funnel-map", "signal-funnel-path", "signal-funnel-outcome"):
        if required not in INDEX_CSS:
            errors.append(f"scout signal capture must use the shared modern signal command visual system: {required}")
    for required in ("SignalFunnelMap", "aria-label=\"四层信号收缩路径\"", "信号收缩路径", "从市场信号到候选商品", "归并率", "signal-funnel-map", "signal-funnel-path", "signal-funnel-outcome", "orderLayers"):
        if required not in SIGNAL_FUNNEL_OVERVIEW:
            errors.append(f"scout signal funnel must render a visual source-to-candidate contraction map: {required}")
    for forbidden in ("FourLayerSignalWorkbench", "setActiveTab(layer.id)", "进入{layer.label}", "min-h-[260px]"):
        if forbidden in SCOUT_SOURCES_VIEW:
            errors.append(f"scout signal capture must not use large clickable cards as the four-layer primary entry: {forbidden}")
    if "<SignalLayerPrimaryTabs" in SCOUT_SOURCES_VIEW and "<SignalFunnelOverview" in SCOUT_SOURCES_VIEW:
        if SCOUT_SOURCES_VIEW.index("<SignalLayerPrimaryTabs") > SCOUT_SOURCES_VIEW.index("<SignalFunnelOverview"):
            errors.append("scout signal capture must render four-layer primary tabs before funnel summaries")
    if "<SignalLayerPrimaryTabs" in SCOUT_SOURCES_VIEW and "activeTab === 'trend'" in SCOUT_SOURCES_VIEW:
        if SCOUT_SOURCES_VIEW.index("<SignalLayerPrimaryTabs") > SCOUT_SOURCES_VIEW.index("activeTab === 'trend'"):
            errors.append("scout signal capture must render four-layer primary tabs before active layer detail")
    for required in ("match?: string[]", "match: ['/scout", "match: ['/products", "match: ['/content", "match: ['/orders", "match: ['/operations", "match: ['/finance"):
        if required not in NAVIGATION:
            errors.append(f"sidebar navigation must declare module-owned route sets: {required}")
    for required in ("item.match", "itemScore(item, path)", "routeScore(route, path)"):
        if required not in SIDEBAR:
            errors.append(f"sidebar must keep primary module active for any route owned by that module: {required}")
    for required in ("activeItemTo", "itemMatchScore", "item.to === activeTo"):
        if required not in MODULE_SUBNAV:
            errors.append(f"module tabs must use single best-match active tab, not prefix-highlight multiple tabs: {required}")
    listing_workspace_content = f"{BATCH_PUBLISH_PREVIEW}\n{BATCH_PUBLISH_QUEUE}\n{BATCH_PUBLISH_COMPLETENESS}"
    for required in ("ListingDraftQueue", "草稿队列", "当前编辑商品", "Listing 一体化工作台", "activeDraftIndex"):
        if required not in listing_workspace_content:
            errors.append(f"listing workbench must use a queue plus one active product editor: {required}")
    for required in ("ListingCompletenessPanel", "Listing 完整度", "分类节点", "搜索关键词", "商品要点", "商品描述", "价格/配送", "变体/SKU", "品牌名称", "Listing 曝光点击转化检查", "曝光", "点击", "转化"):
        if required not in listing_workspace_content:
            errors.append(f"listing workbench must check listing completeness as a product detail page object: {required}")

    if "SETTINGS_GROUPS" in SETTINGS_WORKSPACE:
        errors.append("settings page must not render duplicate grouped shortcut cards")
    for removed in ("NetworkSettings", "ThemeSettings", "network: \"网络状态\"", "theme: \"主题偏好\""):
        if removed in SETTINGS_WORKSPACE:
            errors.append(f"settings page still exposes framework-level concern: {removed}")
    for removed_component, content in (
        ("NetworkSettings", SETTINGS_ACCOUNT_PANELS),
        ("ThemeSettings", SETTINGS_SYSTEM_PANELS),
    ):
        if removed_component in content:
            errors.append(f"settings code must not keep framework-level component: {removed_component}")
    for removed_route in ("'/settings/network'", "'/settings/theme'"):
        if removed_route in ROUTE_META:
            errors.append(f"settings route title must not expose framework-level concern: {removed_route}")
    if "visibleTabIds.has(activeTab)" not in SETTINGS_WORKSPACE:
        errors.append("settings page must redirect unknown or removed tabs to a visible settings tab")
    if "CSV 上架" in ROUTE_META:
        errors.append("content route title must not expose removed Shopee CSV listing workflow")
    if "'/content/export': '平台刊登'" not in ROUTE_META:
        errors.append("content export tab route title must describe platform listing guidance")
    if "'/content': '内容制作'" not in ROUTE_META:
        errors.append("content route title must match the current content production page title")
    for required in ("aria-label=\"内容刊登三阶段浮动导航\"", "data-navigation-style=\"floating-stage-rail\"", "data-ui=\"draggable-stage-rail\"", "data-draggable=\"true\"", "data-collapsible=\"true\"", "data-stage-icon-only=\"true\"", "onPointerDown", "setCollapsed", "内容制作", "定价校验", "平台刊登", "fixed", "z-40"):
        if required not in CONTENT_STAGE_RAIL:
            errors.append(f"content/listing stage rail must be a draggable collapsible floating side rail for downstream stages: {required}")
    if "right-4 top-[148px]" in CONTENT_STAGE_RAIL:
        errors.append("content/listing stage rail must not be hard-fixed to the right edge; it must be draggable")
    if "{index + 1}" in CONTENT_STAGE_RAIL:
        errors.append("content/listing stage rail must use icon-only stage controls instead of 1/2/3 number pills")
    for page_name, page_content in (
        ("content planner", CONTENT_PLANNER_WORKSPACE),
        ("smart pricing", SMART_PRICING_PAGE),
        ("batch publish", BATCH_PUBLISH_WORKSPACE),
    ):
        if "SelectionBusinessPipeline" in page_content:
            errors.append(f"{page_name} must not render the six-step top pipeline; use ContentListingStageRail")
        if "ContentListingStageRail" not in page_content:
            errors.append(f"{page_name} must render ContentListingStageRail as the downstream floating stage rail")

    if "平台同步" not in HEADER:
        errors.append("global sync action must be labeled as platform sync")
    if "同步所有平台" in HEADER and "订单" not in HEADER:
        errors.append("global sync title must explain what is synchronized")
    if "alert(" in SCOUT_WORKSPACE:
        errors.append("scout source synchronization must render inline state instead of browser alerts")
    if "sticky" not in SELECTION_PIPELINE:
        errors.append("selection business pipeline must stay visible as a sticky workflow toolbar")
    if "业务处理总线" not in BUSINESS_FLOW_V2:
        errors.append("business monitor must expose a business processing spine, not only stage cards")
    if "BusinessFlowCommandBoard" not in BUSINESS_FLOW_WORKSPACE:
        errors.append("business monitor must put the flow total-and-breakdown board in the main visual area")
    business_flow_board_with_range_util = BUSINESS_FLOW_COMMAND_BOARD + COMPARISON_RANGE_UTIL + COMPARISON_RANGE_CARDS + COMMAND_INSIGHT_STRIP + METRIC_STACK_BAR
    for required in ("业务流程总分看板", "业务流程卡点总览", "业务处理总览", "当前瓶颈", "卡点率", "待补关键资料", "业务处理动作", "data-ui=\"flow-hero\"", "商品流程数量对比", "业务核心判断条", "业务核心判断", "链路卡点率", "当前瓶颈阶段", "下一步动作", "data-ui=\"command-insight-strip\"", "指标口径 · 业务含义 · 下一步", "本周", "上周", "去年同周", "本月", "上月", "去年同月", "本季度", "上季度", "去年同季", "所选区间", "上一等长区间", "去年同日期区间", "商品流程对比范围说明", "ComparisonRangeCards", "data-ui=\"comparison-range-cards\"", "parseComparisonRange", "aria-label=\"日期起止时间线\"", "实际天数", "开始", "结束", "八阶段卡点矩阵", "平台业务对象分布", "平台对象占比", "店铺卡点热力", "推进结构", "MetricStackBar", "data-ui=\"store-drilldown-priority-bar\"", "店铺业务推进结构", "信号收集", "候选验证", "选品决策", "Listing 制作", "定价策略", "平台刊登", "BarChart", "PieChart", "comparisonRangeLabel"):
        if required not in business_flow_board_with_range_util:
            errors.append(f"business monitor V5 board must expose total/breakdown/stage charts: {required}")
    business_flow_service_content = (ROOT / "backend/app/services/business_flow_service.py").read_text(encoding="utf-8")
    business_flow_projection_content = (ROOT / "backend/app/services/business_flow_projection_service.py").read_text(encoding="utf-8")
    business_flow_dwell_content = business_flow_board_with_range_util + BUSINESS_FLOW_V2 + business_flow_service_content + business_flow_projection_content
    for required in ("avg_wait_label", "max_wait_item", "平均停留", "最长停留", "stage_dwell_stats", "stage_dwell", "阶段停留对比"):
        if required not in business_flow_dwell_content:
            errors.append(f"business flow monitor must expose real stage dwell time and longest waiting object: {required}")
    for forbidden in ("业务对象范围对比", "业务对象对比范围说明", "业务对象周期对比", "业务对象窗口对比", "当前窗口", "上一同长窗口", "去年同窗", "当前周期", "上一周期", "去年同期", "本次统计", "前N天", "去年同N天", "上一个${days}天", "上一个30天", "去年同日${days}天", "去年同日30天", "当前范围", "前一范围", "去年同日期范围", "本期 / 上期 / 去年同期", "统计区间 / 前一等长区间", "当前统计日期区间", "前一等长日期区间", "去年同日期等长区间", "统计日期范围 / 环比日期范围 / 同比日期范围", "本周/上周/去年同周；本月/上月/去年同月", "name=\"业务对象\"", "name=\"卡点对象\"", "name=\"待补对象\"", "label=\"业务对象\"", "label=\"卡点对象\"", "label=\"待补资料\""):
        if forbidden in BUSINESS_FLOW_COMMAND_BOARD:
            errors.append(f"business monitor must not use vague period/object labels: {forbidden}")
    for required in ("stageDwellWindowLabel", "comparisonRangeLabel('current', data.comparison.windows.current)", "comparisonRangeLabel('previous', data.comparison.windows.previous)", "comparisonRangeLabel('lastYear', data.comparison.windows.last_year)"):
        if required not in BUSINESS_FLOW_COMMAND_BOARD:
            errors.append(f"business monitor stage dwell badge must use explicit comparison windows: {required}")
    for required in ("流程商品数", "阻塞商品数", "待补资料商品数"):
        if required not in BUSINESS_FLOW_COMMAND_BOARD:
            errors.append(f"business monitor object chart must use concrete product-flow labels: {required}")
    for required in ("data.comparison.previous", "data.comparison.last_year", "data.flow_store_matrix.length"):
        if required not in BUSINESS_FLOW_COMMAND_BOARD:
            errors.append(f"business monitor total board must use real comparison and full store matrix counts: {required}")
    if "min-h-[104px]" in BUSINESS_FLOW_V2:
        errors.append("business monitor stage ribbon must not regress to large card-like stage blocks")
    if "aria-label=\"业务处理阶段\"" not in BUSINESS_FLOW_V2:
        errors.append("business monitor stage spine must expose an accessible workflow label")
    business_flow_content = f"{BUSINESS_FLOW_V2}\n{BUSINESS_FLOW_CONTEXT_RAIL}\n{BUSINESS_FLOW_COMMAND_BOARD}\n{BUSINESS_FLOW_ROUTES}"
    if "item.image_url" not in business_flow_content:
        errors.append("business monitor must show real product images for item-level workflow context")
    for required in ("item.account_name", "店铺待定位"):
        if required not in BUSINESS_FLOW_V2:
            errors.append(f"business monitor item queue must expose platform/store ownership: {required}")
    if "查看货源" not in business_flow_content:
        errors.append("business monitor context rail must expose the source product link when available")
    for required in ("buildObjectRoute(item.next_action_route, item)", "buildObjectRoute(primaryAction.route, primaryAction)", "buildSourceRefRoute", "candidate_id", "product_id", "content_item_id", "sourcing_item_id", "order_id"):
        if required not in business_flow_content:
            errors.append(f"business monitor context rail must carry current object into downstream route: {required}")
    if "onNavigate(ref.meta.route)" in BUSINESS_FLOW_CONTEXT_RAIL:
        errors.append("business monitor source refs must not navigate directly without object route enrichment")
    if "nextRoute.startsWith('/products/')" not in BUSINESS_FLOW_ROUTES:
        errors.append("business flow route builder must preserve product detail routes without rewriting them as publish routes")
    for required in ("业务链路空状态", "补充真实业务对象", "EmptyFlowState"):
        if required not in BUSINESS_FLOW_V2:
            errors.append(f"business monitor empty state must be a workflow-oriented visual state: {required}")
    for required in ("阶段泳道", "商品泳道", "FlowStageSwimlanes", "data.product_pipeline"):
        if required not in BUSINESS_FLOW_V2:
            errors.append(f"business monitor must render product pipeline as stage swimlanes: {required}")
    if "风险处置中枢" not in RISK_CONTROL_WORKSPACE:
        errors.append("risk control must present itself as a risk command center, not a plain risk list")
    if "RiskStoreCommandBoard" not in RISK_CONTROL_WORKSPACE:
        errors.append("risk control must put the platform/store risk total-and-breakdown board in the main visual area")
    if "aria-label=\"风险处置指标\"" not in RISK_CONTROL_WORKSPACE:
        errors.append("risk control metric strip must expose an accessible risk indicator label")
    for required in ("data-ui=\"risk-date-range-filter\"", "aria-label=\"风险日期快捷窗口\"", "应用风险范围", "getRiskControlOverview(cleanRiskDateRange(appliedRiskDateRange))"):
        if required not in RISK_CONTROL_WORKSPACE:
            errors.append(f"risk control must expose explicit date range filter tied to backend query: {required}")
    if "{ params }" not in RISK_CONTROL_API:
        errors.append("risk control API client must pass explicit date range query params")
    for required in ("data-ui=\"risk-stage2-signal-summary\"", "履约库存利润风险源汇总", "RiskSourceSummaryPanel", "履约超时", "库存断货", "利润异常", "fulfillment_overdue", "inventory_stockout", "profit_anomaly"):
        if required not in RISK_CONTROL_WORKSPACE:
            errors.append(f"risk control must expose fulfillment/inventory/profit source summary cards: {required}")
    risk_board_with_range_util = RISK_STORE_COMMAND_BOARD + COMPARISON_RANGE_UTIL + COMPARISON_RANGE_CARDS + COMMAND_INSIGHT_STRIP + METRIC_STACK_BAR
    for required in ("平台店铺风险总分看板", "平台店铺风险总览", "风险处置总览", "处置优先级", "最高风险店铺", "即将超时", "风险处置动作", "data-ui=\"risk-hero\"", "风险范围对比", "风险核心判断条", "风险核心判断", "风险压力", "逾期处理", "最高风险归属", "data-ui=\"command-insight-strip\"", "指标口径 · 业务含义 · 下一步", "本周", "上周", "去年同周", "本月", "上月", "去年同月", "本季度", "上季度", "去年同季", "所选区间", "上一等长区间", "去年同日期区间", "风险对比范围说明", "ComparisonRangeCards", "data-ui=\"comparison-range-cards\"", "parseComparisonRange", "aria-label=\"日期起止时间线\"", "实际天数", "开始", "结束", "平台风险分布", "平台风险占比", "风险类型雷达", "店铺风险热力", "风险热度", "MetricStackBar", "data-ui=\"store-drilldown-priority-bar\"", "店铺风险热度结构", "店铺商品", "环比", "同比", "BarChart", "PieChart", "comparisonRangeLabel"):
        if required not in risk_board_with_range_util:
            errors.append(f"risk control V5 board must expose total/breakdown/comparison charts: {required}")
    for forbidden in ("风险周期对比", "风险窗口对比", "当前窗口", "上一同长窗口", "去年同窗", "当前周期", "上一周期", "去年同期", "本次统计", "前N天", "去年同N天", "上一个${days}天", "上一个30天", "去年同日${days}天", "去年同日30天", "当前范围", "前一范围", "去年同日期范围", "本期 / 上期 / 去年同期", "统计区间 / 前一等长区间", "当前统计日期区间", "前一等长日期区间", "去年同日期等长区间", "label=\"活跃风险\"", "label=\"高危风险\""):
        if forbidden in RISK_STORE_COMMAND_BOARD:
            errors.append(f"risk control must not use vague period/risk labels: {forbidden}")
    for forbidden in ("当前周期", "上一周期", "当前30天", "上一30天"):
        if forbidden in RISK_CONTROL_SALES_RISK_SERVICE:
            errors.append(f"sales decline risk backend must use explicit 30-day range labels: {forbidden}")
    for required in ("前一连续30天", "近30天", "Listing performance 近30天与前一连续30天真实平台指标"):
        if required not in RISK_CONTROL_SALES_RISK_SERVICE:
            errors.append(f"sales decline risk backend must expose concrete comparison ranges: {required}")
    for required in ("RadarChart", "Radar", "PolarGrid", "PolarAngleAxis", "PolarRadiusAxis", "风险类型雷达图"):
        if required not in RISK_STORE_COMMAND_BOARD:
            errors.append(f"risk control V5 board must render a real radar chart for risk categories: {required}")
    for required in ("risk.platform", "risk.account_name", "处理时限", "risk.due_at", "risk.response_deadline_at", "预计影响", "剩余处理", "risk.estimated_impact", "risk.remaining_time_label"):
        if required not in RISK_CONTROL_WORKSPACE:
            errors.append(f"risk queue must expose concrete platform/store/object handling context: {required}")
    if "风险雷达" not in RISK_SIGNAL_BOARD:
        errors.append("risk control evidence panel must include a risk radar, not only generic heatmap wording")
    for required in ("风险处置矩阵", "RiskDispositionMatrix", "data.risk_radar"):
        if required not in RISK_SIGNAL_BOARD:
            errors.append(f"risk control must render risk_radar as a disposition matrix: {required}")
    for required in ("处置状态", "SLA状态", "RiskDispositionStatusCard"):
        if required not in RISK_CONTROL_WORKSPACE:
            errors.append(f"risk control right panel must expose selected risk disposition state: {required}")
    if "证据链路" in RISK_CONTROL_WORKSPACE:
        errors.append("risk control must not expose internal evidence-chain wording as the main panel title")
    for required in ("队列密度", "风险排序", "RiskQueueDensityBar"):
        if required not in RISK_CONTROL_WORKSPACE:
            errors.append(f"risk control queue must expose compact density and ordering context: {required}")
    for required in ("数据范围", "关联业务记录", "RiskEvidenceCard", "业务记录编号", "预计影响", "剩余处理", "risk.response_deadline_at"):
        if required not in RISK_EVIDENCE_PANEL:
            errors.append(f"risk control evidence panel must render source refs as business-readable records: {required}")
    for required in ("处理时间线", "TimelineNode", "aria-label=\"风险处理时间线\""):
        if required not in RISK_EVIDENCE_PANEL:
            errors.append(f"risk control audit trail must render as a disposal timeline: {required}")
    if "经营指挥中枢" not in COCKPIT_WORKSPACE:
        errors.append("operating cockpit must present itself as a command center, not a plain summary strip")
    if "运营驾驶舱" in COCKPIT_WORKSPACE:
        errors.append("operating cockpit must not expose the outdated cockpit label")
    if "aria-label=\"经营指挥指标\"" not in COCKPIT_WORKSPACE:
        errors.append("operating cockpit metric strip must expose an accessible command indicator label")
    if "CockpitStoreCommandBoard" not in COCKPIT_WORKSPACE:
        errors.append("operating cockpit must put the platform/store total-and-breakdown board in the main visual area")
    cockpit_board_with_range_util = COCKPIT_STORE_COMMAND_BOARD + COMPARISON_RANGE_UTIL + COMPARISON_RANGE_CARDS + COMMAND_INSIGHT_STRIP + METRIC_STACK_BAR
    for required in ("平台店铺经营总分看板", "公司 → 平台 → 店铺经营总览", "公司级经营总览", "经营覆盖", "资金质量", "主力店铺", "经营下钻动作", "data-ui=\"operating-hero\"", "经营范围对比", "经营核心判断条", "经营核心判断", "公司经营结果", "店铺贡献最高", "利润率口径", "data-ui=\"command-insight-strip\"", "指标口径 · 业务含义 · 下一步", "本周", "上周", "去年同周", "本月", "上月", "去年同月", "本季度", "上季度", "去年同季", "所选区间", "上一等长区间", "去年同日期区间", "经营对比范围说明", "ComparisonRangeCards", "data-ui=\"comparison-range-cards\"", "parseComparisonRange", "aria-label=\"日期起止时间线\"", "实际天数", "开始", "结束", "平台经营分布", "平台占比", "店铺贡献排行", "店铺经营贡献结构", "MetricStackBar", "data-ui=\"store-drilldown-priority-bar\"", "环比", "同比", "BarChart", "PieChart", "comparisonRangeLabel"):
        if required not in cockpit_board_with_range_util:
            errors.append(f"operating cockpit V5 board must expose total/breakdown/comparison charts: {required}")
    for forbidden in ("经营周期对比", "经营窗口对比", "当前窗口", "上一同长窗口", "去年同窗", "当前周期", "上一周期", "去年同期", "本次统计", "前N天", "去年同N天", "上一个${days}天", "上一个30天", "去年同日${days}天", "去年同日30天", "当前范围", "前一范围", "去年同日期范围", "本期 / 上期 / 去年同期", "统计区间 / 前一等长区间", "当前统计日期区间", "前一等长日期区间", "去年同日期等长区间", "周期财务结构", "本期订单", "本期收入", "本期净利润"):
        if forbidden in COCKPIT_STORE_COMMAND_BOARD:
            errors.append(f"operating cockpit must not use vague period wording: {forbidden}")
    for required in ("店铺贡献排行", "店铺商品", "订单", "物流", "财务", "复核店铺物流", "/shipments?platform_account_id=", "收入待同步", "last_sync_at", "未同步"):
        if required not in COCKPIT_STORE_COMMAND_BOARD:
            errors.append(f"operating cockpit store board must expose store-level table and drilldowns: {required}")
    for required in ("店铺资金分布", "投入/成本", "绑定台账", "ledger_entry_count", "revenue_rmb", "cost_rmb", "net_profit_rmb", "只统计明确绑定店铺的财务台账"):
        if required not in COCKPIT_STORE_COMMAND_BOARD + COCKPIT_TYPES:
            errors.append(f"operating cockpit store board must expose per-store finance breakdown: {required}")
    for required in ("aria-label=\"经营日期快捷窗口\"", "buildOperatingDateShortcuts", "week_to_date", "month_to_date", "quarter_to_date", "本周", "本月", "本季度", "formatDateLocal", "onApply(cleanFilters(next))"):
        if required not in COCKPIT_SCOPE_FILTERS:
            errors.append(f"operating cockpit scope filters must expose explicit week/month/quarter date shortcuts: {required}")
    for forbidden in ("风险摘要", "链路摘要", "报表异常", "AI 运营建议", "CockpitHealthRadar", "经营健康雷达"):
        if forbidden in COCKPIT_WORKSPACE:
            errors.append(f"operating cockpit main workspace must not promote non-operating summaries as primary sections: {forbidden}")
    for required in ("资金结构", "利润构成", "CockpitFinancialStructure"):
        if required not in COCKPIT_WORKSPACE:
            errors.append(f"operating cockpit finance panel must expose capital structure detail: {required}")
    for required in ("数据时间范围", "处理优先级", "CockpitDataWindow", "经营待处理", "数据来源", "关联记录"):
        if required not in COCKPIT_SIDEBAR:
            errors.append(f"operating cockpit right rail must use business-readable data and action wording: {required}")
    for forbidden in ("<h2 className=\"text-sm font-semibold text-[var(--color-fg)]\">行动队列</h2>", "<h2 className=\"text-sm font-semibold text-[var(--color-fg)]\">证据来源</h2>", "<h2 className=\"text-sm font-semibold text-[var(--color-fg)]\">证据窗口</h2>"):
        if forbidden in COCKPIT_SIDEBAR:
            errors.append(f"operating cockpit must not expose internal evidence/action wording as main right-rail titles: {forbidden}")
    cockpit_product_ops_content = f"{COCKPIT_WORKSPACE}\n{COCKPIT_TYPES}\n{COCKPIT_COMMAND_WIDGETS}\n{COCKPIT_METRIC_STRIP}"
    for required in ("product_operations", "商品运营表现", "商品运营待复盘", "reviewed_action_count", "pending_action_count"):
        if required not in cockpit_product_ops_content:
            errors.append(f"operating cockpit must expose product operation performance and review drilldown: {required}")
    trend_candidate_content = f"{TREND_DISCOVERY_WORKSPACE}\n{RECOMMENDATION_EVIDENCE_PANEL}\n{RECOMMENDER_READINESS_PANEL}"
    if "候选商品池" not in trend_candidate_content:
        errors.append("trend candidate page must expose the candidate product pool before tabbed tools")
    if "推荐候选商品" not in trend_candidate_content:
        errors.append("trend candidate page must surface recommended product candidates as the primary object")
    for required in (
        "CandidatePoolSourceHub",
        "aria-label=\"候选池数据入口\"",
        "activeCandidateSource",
        "setActiveCandidateSource",
        "补趋势",
        "补图片",
        "补热卖",
        "补推荐",
        "看选品库",
    ):
        if required not in TREND_DISCOVERY_WORKSPACE:
            errors.append(f"candidate validation must unify supporting tools as candidate-pool data entrances: {required}")
    for forbidden in ("const PAGE_TABS", "<Tabs tabs={PAGE_TABS}", "label: \"趋势热点\"", "label: \"图片选品\"", "label: \"热卖商品\"", "label: \"选品推荐\"", "label: \"选品库\""):
        if forbidden in TREND_DISCOVERY_WORKSPACE:
            errors.append(f"candidate validation must not expose separated top-level tool tabs: {forbidden}")
    for required in ("CandidatePoolTable", "aria-label=\"候选商品池主表\"", "selectedRecommendationId", "候选详情侧栏", "资料完整度", "商品图", "候选素材", "查看来源"):
        if required not in RECOMMENDATION_EVIDENCE_PANEL:
            errors.append(f"trend candidate page must use a compact product-pool table instead of stacked cards: {required}")
    for required in ("2xl:grid-cols-[minmax(0,1fr)_320px]", "2xl:sticky", "min-w-[860px]"):
        if required not in RECOMMENDATION_EVIDENCE_PANEL:
            errors.append(f"trend candidate page must protect the product-pool table from collapsing beside the floating rail: {required}")
    for required in ("useNavigate", "/product-selection?candidate_id=", "platform=", "market=", "进入选品决策"):
        if required not in RECOMMENDATION_EVIDENCE_PANEL:
            errors.append(f"trend recommendation card must drill into selection decision with candidate context: {required}")
    for required in ("evidenceSummary(item)", "evidenceCompleteness(item)", "safeTextList(item.keywords)", "safeTextList(item.listing_tips)", "验证资料待补齐"):
        if required not in RECOMMENDATION_EVIDENCE_PANEL:
            errors.append(f"trend recommendation card must tolerate missing evidence fields without ErrorBoundary crash: {required}")
    if "选品决策准备度" not in trend_candidate_content:
        errors.append("trend candidate page must show selection decision readiness in business language")
    if "PIPELINE_STAGE_OPTIONS" in TREND_PIPELINE_UTILS:
        errors.append("trend pipeline stages must come from runtime config, not local option constants")
    if "window.alert" in TREND_DISCOVERY_FILES or "alert(" in TREND_DISCOVERY_FILES:
        errors.append("trend discovery interactions must use inline state or toast, not browser alerts")
    product_selection_content = f"{PRODUCT_SELECTION_WORKSPACE}\n{PRODUCT_SELECTION_CORE_TABS}\n{DECISION_CANDIDATE_CONTEXT}"
    if "选品决策" not in product_selection_content or "围绕一个候选商品" not in product_selection_content:
        errors.append("product selection decision page must focus on one concrete candidate product before scoring")
    if "aria-label=\"选品决策商品上下文\"" not in product_selection_content:
        errors.append("product selection decision page must expose concrete product context before scoring")
    if "九维决策评分" not in product_selection_content:
        errors.append("product selection decision page must name the scoring area as nine-dimension decision scoring")
    if "2xl:grid-cols-[minmax(280px,320px)_minmax(520px,1fr)_minmax(280px,320px)]" not in PRODUCT_SELECTION_CORE_TABS:
        errors.append("product selection decision workspace must only expand to three columns on very wide screens")
    for required in (
        "CandidateDecisionWorkbench",
        "候选商品决策工作台",
        "aria-label=\"决策商品池\"",
        "aria-label=\"决策分析面板\"",
        "平台适配",
        "进入内容工厂",
        "补资料",
        "观察",
        "淘汰",
    ):
        if required not in product_selection_content:
            errors.append(f"product selection decision page must use a one-product decision workbench: {required}")
    for forbidden in (
        "{ id: 'research', label: '关键词研究' }",
        "{ id: 'competitors', label: '竞品监控' }",
        "{ id: 'profitability', label: '盈利计算' }",
    ):
        if forbidden in PRODUCT_SELECTION_WORKSPACE:
            errors.append(f"product selection decision page must not split core decision into top-level tool tabs: {forbidden}")
    for required in ("useSearchParams", "candidate_id", "initialCandidateId", "setCandidateId(initialCandidateId)"):
        if required not in PRODUCT_SELECTION_CORE_TABS:
            errors.append(f"product selection decision page must auto-select candidate from route parameter: {required}")
    if "aria-label=\"定价商品上下文\"" not in PRICING_ITEM_SELECTOR:
        errors.append("pricing workbench must show concrete product context before price calculation")
    for required in ("useSearchParams", "content_item_id", "initialProductId", "matchesPricingProduct"):
        if required not in SMART_PRICING_PAGE:
            errors.append(f"pricing page must auto-select content item from route parameter: {required}")
    for required in ("useQuery", "queryKey: ['pricing-workbench']", "pricingWorkbenchQuery", "data-ui=\"pricing-workbench-error\"", "重新加载定价队列"):
        if required not in SMART_PRICING_PAGE:
            errors.append(f"AUDIT-P2-03 pricing page must use React Query boundary and visible workbench error state: {required}")
    if "getPricingWorkbench" not in PRICING_API or "client.get<ApiResponse<PricingWorkbench>>" not in PRICING_API:
        errors.append("AUDIT-P2-03 pricing workbench must stay behind api/pricing.ts encapsulation")
    for required in ("nextRoute.startsWith('/pricing')", "content_item_id", "product_id: productId || contentItemId"):
        if required not in BUSINESS_FLOW_ROUTES:
            errors.append(f"business flow route builder must carry product_id into pricing route: {required}")
    for required in ("confirmedProductId", "/publish?product_id=${confirmedProductId}", "进入平台刊登"):
        if required not in SMART_PRICING_PAGE:
            errors.append(f"pricing page must continue confirmed product into batch publishing: {required}")
    for required in ("查看货源", "平台字段组核验", "素材要求"):
        if required not in PRICING_ITEM_SELECTOR:
            errors.append(f"pricing item selector must expose {required} for the selected product")
    for required in (
        "listing_store_override",
        "aria-label=\"店铺 Listing 覆盖定价上下文\"",
        "店铺 Listing 覆盖字段",
        "已从内容制作回读",
        "覆盖店铺",
        "覆盖标题",
        "覆盖图片",
        "SKU/合规",
    ):
        if required not in PRICING_API + PRICING_ITEM_SELECTOR:
            errors.append(f"pricing workbench must carry content store listing override into pricing context: {required}")
    for required in ("overrideStoreId", "item.listing_store_override?.store_id"):
        if required not in SMART_PRICING_PAGE:
            errors.append(f"pricing page must prefer the store selected in content store override: {required}")
    for required in ("media_readiness", "媒体缺口", "已采集", "平台至少", "缺口："):
        if required not in CONTENT_PRODUCT_QUEUE + PRICING_ITEM_SELECTOR + BATCH_PUBLISH_SELECT + BATCH_PUBLISH_COMPLETENESS:
            errors.append(f"content/pricing/listing workbenches must expose media readiness gaps: {required}")
    if "aria-label=\"素材商品上下文\"" not in CONTENT_MEDIA_STUDIO:
        errors.append("content media studio must expose the selected product context before image/video processing")
    if "使用当前商品源图处理" not in CONTENT_MEDIA_STUDIO:
        errors.append("content media studio must support using the selected product source image")
    content_media_surface = CONTENT_MEDIA_STUDIO + SELLER_IMAGE_EDITOR_WORKBENCH
    for required in (
        "ListingMediaSlotBoard",
        "data-ui=\"listing-media-editor-seller-console\"",
        "SellerImageEditorWorkbench",
        "data-ui=\"listing-image-editor-workbench\"",
        "2xl:grid-cols-[220px_minmax(640px,1fr)_180px]",
        "aria-label=\"Listing 图片编辑工作台\"",
        "aria-label=\"左侧图片工具栏\"",
        "aria-label=\"图片编辑画布\"",
        "aria-label=\"右侧图片槽位缩略图\"",
        "真实素材绑定",
        "消除笔",
        "裁剪旋转",
        "修改尺寸",
        "AI设计",
        "上传/替换当前槽位",
        "保存槽位顺序",
        "setAsMainImage",
        "reorderSlot",
        "replaceActiveSlotWithAsset",
        "uploadSlotImage",
        "data-ui=\"image-slot-file-input\"",
        "data-ui=\"listing-image-empty-slot\"",
        "data-ui=\"replace-active-slot-with-asset\"",
        "{activeSlot.index}/{imageSlots.length}",
        "aria-label=\"Listing 媒体字段快速定位\"",
        "data-ui=\"media-editor-section-nav\"",
        "aria-label=\"Listing 图片槽位工作台\"",
        "aria-label=\"卖家后台图片槽位主表\"",
        "平台图片槽位与素材门禁",
        "图片角色",
        "素材状态",
        "处理动作",
        "待补真实图片",
        "aria-label=\"Listing 图片处理动作\"",
        "aria-label=\"图片处理参数表\"",
        "aria-label=\"视频素材编辑区\"",
        "商品视频",
        "aria-label=\"当前商品素材库\"",
        "当前商品素材库",
        "处理当前主图",
        "MediaHealthCard",
        "productImageAssets",
        "productVideoAssets",
    ):
        if required not in content_media_surface:
            errors.append(f"content media studio must expose seller-console listing media slots: {required}")
    for forbidden in ("grid-cols-[220px_minmax(520px,1fr)_150px]",):
        if forbidden in CONTENT_MEDIA_STUDIO:
            errors.append(f"content media studio must not force the image editor into a compressed three-column layout: {forbidden}")
    for required in (
        "aria-label=\"Listing 文案编辑工作台\"",
        "data-ui=\"listing-copy-editor-seller-console\"",
        "aria-label=\"Listing 文案字段快速定位\"",
        "data-ui=\"copy-editor-section-nav\"",
        "aria-label=\"卖家后台标题编辑区\"",
        "aria-label=\"平台标题规则状态表\"",
        "标题规则",
        "待优化",
        "标题、五点卖点与长描述编辑台",
        "Listing 文案校验面板",
        "标题候选与人工定稿",
        "五点卖点",
        "aria-label=\"五点卖点编辑表\"",
        "卖点类型",
        "买家可见内容",
        "长描述 / 商品详情",
        "aria-label=\"长描述编辑区\"",
        "saveAndConfirm('listing_copy'",
        "saveAndConfirm('selling_points'",
        "saveAndConfirm('description'",
        "saveContentTaskVersion",
        "confirmContentTaskVersion",
    ):
        if required not in CONTENT_TITLE_GENERATOR:
            errors.append(f"content title generator must behave as a seller-console listing copy editor: {required}")
    for forbidden in ("xl:grid-cols-[280px_minmax(0,1fr)_260px]", "xl:border-l xl:border-t-0"):
        if forbidden in CONTENT_TITLE_GENERATOR:
            errors.append(f"content title generator must not squeeze listing copy fields into narrow side rails: {forbidden}")
    for required in ("useConfirm", "删除内容素材", "确认删除素材"):
        if required not in CONTENT_MEDIA_STUDIO:
            errors.append(f"content media asset delete must use system confirm dialog: {required}")
    for required in ("useConfirm", "删除选品图片", "确认删除图片"):
        if required not in TREND_DISCOVERY_FILES:
            errors.append(f"trend discovery image delete must use system confirm dialog: {required}")
    if "ContentCsvExport" in CONTENT_PLANNER_WORKSPACE or "Shopee批量上架CSV" in CONTENT_PLANNER_WORKSPACE:
        errors.append("content planner must not expose the old Shopee-only CSV listing workflow")
    for required in ("useSearchParams", "product_id", "initialProductId"):
        if required not in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content planner must auto-select product from route parameter: {required}")
    if "aria-label=\"专业工作台视觉框架\"" not in PROFESSIONAL_WORKSPACE_FRAME:
        errors.append("professional workspace visual frame component must exist with accessible shell label")
    if "aria-label=\"业务对象下钻动作\"" not in BUSINESS_OBJECT_ACTION_BAR:
        errors.append("business object action bar must exist with accessible drill-down action label")
    for required in ("内容工厂待制作产品列表", "data-ui=\"content-factory-product-queue-page\"", "data-ui=\"content-queue-command-toolbar\"", "min-h-[calc(100vh-190px)]", "data-ui=\"content-listing-detail-overlay-workspace\"", "data-ui=\"content-image-edit-overlay-workspace\"", "data-ui=\"content-factory-editor-overlay\"", "覆盖式工作台", "workspaceMode === 'listing'", "workspaceMode === 'image'", "onOpenListing", "SellerPlatformListingEditorPanel", "layout=\"table\""):
        if required not in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content planner must separate queue, listing detail, and image editor flows: {required}")
    for forbidden in ("onOpenImageEditor={openImageEditor}", "编辑主图", "ListingCompositionBoard product={selectedProduct}"):
        if forbidden in CONTENT_PLANNER_WORKSPACE or forbidden in CONTENT_PRODUCT_QUEUE:
            errors.append(f"content factory queue/detail must not expose old squeezed or misplaced action: {forbidden}")
    for required in ("listing-master-copy", "listing-master-media", "listing-master-attributes", "listing-master-sku", "listing-master-logistics"):
        if required not in CONTENT_PLANNER_WORKSPACE + SELLER_PLATFORM_LISTING_EDITOR:
            errors.append(f"listing detail must keep direct anchors to editable sections: {required}")
    for forbidden in ("内容诊断", "Preview", "Product Detail"):
        if forbidden in SELLER_PLATFORM_LISTING_EDITOR:
            errors.append(f"seller listing editor embedded in CBHunter must not copy platform side diagnosis/preview panels: {forbidden}")
    for required in (
        "density=\"compact\"",
        "data-ui=\"content-listing-compact-toolbar\"",
        "aria-label=\"单商品 Listing 详情编辑工作区\"",
        "aria-label=\"当前商品主图编辑工作区\"",
    ):
        if required not in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content factory must prioritize editable listing workspace over explanatory cards: {required}")
    for forbidden in (
        "aria-label=\"AI 内容与视频计划辅助折叠区\"",
        "aria-label=\"Listing 校验与衔接折叠区\"",
        "aria-label=\"店铺 Listing 覆盖字段折叠编辑区\"",
        "aria-label=\"Listing 对象关系折叠说明\"",
        "ContentListingContextPanel",
        "ListingObjectScopeMap product={selectedProduct}",
        "ListingStoreOverrideEditor",
        "ContentTaskMatrix product={selectedProduct}",
    ):
        if forbidden in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content factory detail page must not expose backend/explanatory panels in the primary editor: {forbidden}")
    for forbidden in ("xl:grid-cols-[380px_minmax(720px,1fr)_360px]", "xl:grid-cols-[320px_minmax(900px,1fr)]", "professional-context-rail space-y-3"):
        if forbidden in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content planner must not squeeze the listing editor with a permanent right rail: {forbidden}")
    if "description=\"围绕已决策商品编制标题、卖点、视频、图片处理和刊登前内容任务，所有内容必须绑定具体商品和平台字段。\"" in CONTENT_PLANNER_WORKSPACE:
        errors.append("content factory must not render a large explanatory description card above the listing editor")
    if "xl:grid-cols-[minmax(0,1fr)_320px]" in LISTING_STORE_OVERRIDE_EDITOR:
        errors.append("listing store override editor must not squeeze store-level fields with a permanent status side rail")
    for required in (
        "aria-label=\"当前商品 Listing 对象总览\"",
        "当前编辑商品",
        "ListingReadinessMeter",
        "ListingFact",
        "主图 {imageCount}/{recommendedImages}",
        "价格链路",
        "当前缺口",
        "暂无阻断缺口",
        "data-ui=\"listing-gap-jump-chip\"",
    ):
        if required not in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content planner must expose a seller-backend style current listing object overview: {required}")
    for required in (
        "listingImageRoleByIndex",
        "main_image",
        "scene_image",
        "dimension_image",
        "detail_image",
        "sku_image",
        "description_image",
        "role: slot.role || roleMeta.role",
        "label: slot.label || roleMeta.label",
    ):
        if required not in CONTENT_MEDIA_STUDIO + SELLER_IMAGE_EDITOR_WORKBENCH:
            errors.append(f"content media studio must preserve V5 image slot roles in saved image plans: {required}")
    for required in (
        "SellerPlatformListingEditorPanel",
        "data-ui=\"unified-listing-master-editor\"",
        "aria-label=\"统一 Listing 母版编辑器\"",
        "data-ui=\"unified-listing-sticky-field-nav\"",
        "data-ui=\"listing-gap-clickable-summary\"",
        "aria-label=\"Listing 缺口点击定位摘要\"",
        "data-ui=\"listing-gap-click-to-field\"",
        "当前缺口定位",
        "点击标签直接定位到对应编辑区",
        "buildListingGaps",
        "图片不足",
        "SKU 销售资料待补",
        "data-ui=\"listing-master-image-slot-grid\"",
        "dropImageSlot",
        "draggable",
        "onDrop",
        "data-ui=\"listing-master-add-image-slot\"",
        "添加图片",
        "setMainImage",
        "image_slots",
        "场景辅图",
        "尺寸图",
        "细节图",
        "SKU图",
        "详情图",
        "搜索页首图 / 商品页主图",
        "统一 Listing 母版",
        "一次编辑，按店铺实例分发到 Shopee / TEMU / TikTok Shop",
        "商品基础内容在母版维护",
        "商品图片与素材",
        "商品标题与商品描述",
        "商品描述 / 图文详情",
        "类目属性",
        "SKU、销售资料与库存",
        "data-ui=\"seller-listing-platform-attribute-editor\"",
        "aria-label=\"卖家后台平台属性编辑区\"",
        "aria-label=\"平台必填字段状态表\"",
        "data-ui=\"seller-listing-sku-sales-editor\"",
        "aria-label=\"卖家后台 SKU 销售资料编辑区\"",
        "aria-label=\"SKU 批量操作工具条\"",
        "aria-label=\"卖家后台 SKU 销售资料编辑表\"",
        "规格一",
        "规格二",
        "平台 SKU / SPU/SKC",
        "SKU 图角色",
        "包装尺寸",
        "填充启用 SKU",
        "新增 SKU 变体",
        "物流、包装与合规",
        "listing-inline-ai-title",
        "listing-inline-ai-description",
        "保存母版草稿",
        "保存到店铺覆盖",
    ):
        if required not in CONTENT_PLANNER_WORKSPACE + SELLER_PLATFORM_LISTING_EDITOR + SELLER_PLATFORM_LISTING_EDITOR_UTILS:
            errors.append(f"content planner must expose a focused same-product listing editor: {required}")
    for forbidden in ("xl:grid-cols-[240px_minmax(560px,1fr)_260px]",):
        if forbidden in SELLER_PLATFORM_LISTING_EDITOR:
            errors.append(f"seller platform listing editor must not force the editing form into a compressed three-column layout: {forbidden}")
    for forbidden in ("xl:grid-cols-5", "进入编制 <ArrowRight"):
        if forbidden in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content planner listing composition must not regress to large clickable-card grid: {forbidden}")
    for forbidden in ("<ListingUnifiedEditorSections", "AI 内容辅助、视频计划与搜索词", "短视频与内容计划", "标签与搜索词"):
        if forbidden in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content planner listing detail must not mix secondary AI/video/search helpers into primary listing editor: {forbidden}")
    for forbidden in ("xl:grid-cols-[180px_minmax(0,1fr)_240px]", "xl:border-l xl:border-t-0"):
        if forbidden in LISTING_UNIFIED_EDITOR_SECTIONS:
            errors.append(f"listing unified editor must not compress fields into nested three-column layout: {forbidden}")
    for required in (
        "aria-label=\"Listing 搜索词后台编辑区\"",
        "data-ui=\"listing-search-terms-editor\"",
        "后台 Search Terms",
        "品类词",
        "场景词",
        "平台标签",
        "搜索词来源",
        "复制搜索词包",
        "onCopy(searchTermPackage",
    ):
        if required not in LISTING_UNIFIED_EDITOR_SECTIONS:
            errors.append(f"listing unified editor must expose seller-backend search terms editing: {required}")
    for required in (
        "aria-label=\"Listing SKU 属性物流合规工作台\"",
        "data-ui=\"listing-spec-editor-seller-console\"",
        "aria-label=\"Listing 规格字段快速定位\"",
        "data-ui=\"spec-editor-section-nav\"",
        "aria-label=\"卖家后台规格编辑主表\"",
        "SKU/变体、平台属性、物流包装、合规检查",
        "aria-label=\"SKU 变体草稿表\"",
        "商家SKU",
        "平台SKU",
        "SPU/SKC",
        "变体属性",
        "aria-label=\"平台属性编辑工作台\"",
        "aria-label=\"平台必填字段状态表\"",
        "字段状态",
        "待填写",
        "PlatformFieldGroupEditor",
        "aria-label=\"物流包装编辑区\"",
        "aria-label=\"物流包裹尺寸表\"",
        "aria-label=\"规格合规校验面板\"",
        "confirmCompliance",
        "saveContentTaskVersion(product.id, 'compliance_check'",
        "getContentTaskMatrix(product.id)",
        "parseListingOverridePayload",
        "saveSpecificationOverride",
        "saveContentTaskVersion(product.id, 'listing_store_override'",
        "confirmContentTaskVersion(product.id, 'listing_store_override'",
        "保存规格到店铺覆盖草稿",
        "复制规格字段包",
    ):
        if required not in LISTING_SPECIFICATION_EDITOR:
            errors.append(f"content planner must expose actionable listing specs/attributes/logistics/compliance editor: {required}")
    if "xl:grid-cols-[minmax(0,1fr)_320px]" in LISTING_SPECIFICATION_EDITOR:
        errors.append("listing specification editor must not squeeze SKU/spec fields with a permanent compliance side rail")
    if "xl:grid-cols-[minmax(0,1fr)_280px]" in CONTENT_MEDIA_STUDIO:
        errors.append("content media studio must not squeeze image slots with a permanent image action side rail")
    for required in ("draggable", "onDragStart", "onDragOver", "onDrop", "reorderSlot", "新增图片空位", "aria-label=\"新增图片空位\"", "拖拽缩略图调整主图/辅图顺序"):
        if required not in CONTENT_MEDIA_STUDIO:
            errors.append(f"content media studio must support drag-sort image slots and add empty slots: {required}")
    for required in ("aria-label=\"图片裁剪参数表\"", "aria-label=\"图片水印参数表\"", "crop_mode", "crop_x", "crop_width", "watermark_text", "watermark_position", "rotate_degrees", "flip_horizontal", "flip_vertical", "image_edit_options"):
        if required not in CONTENT_MEDIA_STUDIO:
            errors.append(f"content media studio must persist crop/watermark image edit options: {required}")
    for required in ("data-ui=\"image-orientation-controls\"", "旋转90°", "水平翻转", "垂直翻转"):
        if required not in SELLER_IMAGE_EDITOR_WORKBENCH:
            errors.append(f"seller image editor must expose deterministic orientation controls: {required}")
    for required in ("platformAttributeAliases", "platformFields(platformRequirements)", "pickLegacyAttributes"):
        if required not in SELLER_PLATFORM_LISTING_EDITOR_UTILS:
            errors.append(f"listing editor must merge dynamic platform field schema before legacy compatibility fields: {required}")
    if "...pickAttributes(draft)" in SELLER_PLATFORM_LISTING_EDITOR_UTILS:
        errors.append("listing editor must not blindly overwrite platform schema attribute values with old hardcoded pickAttributes")
    for forbidden in ("moveSlot(", "上移</button>", "下移</button>"):
        if forbidden in CONTENT_MEDIA_STUDIO:
            errors.append(f"content media studio must not rely on old up/down image sorting buttons: {forbidden}")
    for forbidden in ("const CONTENT_TABS", "<Tabs tabs={CONTENT_TABS}", "activeTab ===", "{ id: 'title', label: 'AI标题' }", "{ id: 'export', label: '平台刊登' }", "{ id: 'media', label: '素材工坊' }"):
        if forbidden in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content planner tabs must not expose split tool/module labels: {forbidden}")
    for forbidden in (
        "ContentPlatformMappingPanel",
        "aria-label=\"三平台 Listing 字段映射与差异缺口\"",
        "data-ui=\"platform-listing-field-mapping-panel\"",
        "统一母版负责沉淀 90% 共性字段",
    ):
        if forbidden in CONTENT_PLANNER_WORKSPACE:
            errors.append(f"content planner primary listing editor must not expose platform-difference mapping panels: {forbidden}")
    if "aria-label=\"内容商品侧边队列\"" not in CONTENT_PRODUCT_QUEUE:
        errors.append("content product queue must support compact side-rail selection inside the listing workbench")
    for required in (
        "data-ui=\"content-product-seller-filter-toolbar\"",
        "data-ui=\"content-product-seller-console-table\"",
        "商品信息",
        "平台 / 店铺 / 市场",
        "图片 / 视频",
        "标题 / 描述",
        "SKU / 属性",
        "价格 / 库存",
        "待处理缺口",
        "搜索商品名称、平台、市场、类目",
        "statusFilter",
    ):
        if required not in CONTENT_PRODUCT_QUEUE:
            errors.append(f"content product queue must follow seller-console product list structure: {required}")
    for required in (
        "图片/水印模板",
        "data-ui=\"image-watermark-template-workspace\"",
        "data-ui=\"watermark-template-filter-toolbar\"",
        "data-ui=\"watermark-template-console-table\"",
        "营销水印",
        "我的主图水印",
        "系统水印模板",
        "创建水印",
        "搜水印 / 搜产品",
        "水印信息",
        "水印状态",
        "定时添加",
        "编辑水印",
        "删除水印",
        "投放详情",
        "追加投放",
        "fabric.js / cropperjs",
    ):
        if required not in MODULE_SUBNAV + ROUTE_META + LISTING_TEMPLATES_WORKSPACE:
            errors.append(f"listing templates route must become Miaoshou-style image/watermark templates: {required}")
    for forbidden in ("Listing 模板", "标题模板", "描述模板", "新建 Listing 模板", "编辑 Listing 模板"):
        if forbidden in MODULE_SUBNAV + ROUTE_META + LISTING_TEMPLATES_WORKSPACE:
            errors.append(f"content publishing templates must not regress to duplicated listing copy templates: {forbidden}")
    for required in ("aria-label=\"内容商品队列分页\"", "queuePage", "visibleItems", "getPageSize", "上一页", "下一页"):
        if required not in CONTENT_PRODUCT_QUEUE:
            errors.append(f"content product queue must paginate dense listing workbench items: {required}")
    for required in ("useQuery", "contentWorkbenchQuery", "queryKey: ['content-workbench']", "data-ui=\"content-workbench-error\"", "重新加载内容商品队列"):
        if required not in CONTENT_PRODUCT_QUEUE:
            errors.append(f"AUDIT-P2-03 content product queue must use React Query and visible error recovery: {required}")
    if "证据 {item.evidence_summary.present}" in CONTENT_PRODUCT_QUEUE:
        errors.append("content product queue must use user-facing 资料 wording instead of 证据 in the product list")
    for page_name, page_content in (
        ("content planner", CONTENT_PLANNER_WORKSPACE),
        ("batch publish", BATCH_PUBLISH_WORKSPACE),
        ("product list", PRODUCT_LIST_PAGE),
    ):
        if "ProfessionalWorkspaceFrame" not in page_content:
            errors.append(f"{page_name} must use the professional workspace visual frame")
    if "内容到刊登商品上下文" not in CONTENT_PUBLISH_GUIDE:
        errors.append("content planner publish tab must guide selected product into pricing and batch publishing")
    for required in ("content_item_id=${product.id}", "product_id=", "带入当前商品"):
        if required not in CONTENT_PUBLISH_GUIDE:
            errors.append(f"content publish guide must carry selected object id into downstream pages: {required}")
    for page_name, page_content in (
        ("content publish guide", CONTENT_PUBLISH_GUIDE),
        ("batch publish", BATCH_PUBLISH_WORKSPACE),
        ("product seller workbench", PRODUCT_SELLER_WORKBENCH),
    ):
        if "BusinessObjectActionBar" not in page_content:
            errors.append(f"{page_name} must use shared business object drill-down actions")
    for required in ("activeProductId", "`/products/${activeProductId}`", "`/content?product_id=${activeProductId}`", "`/pricing?product_id=${activeProductId}`"):
        if required not in BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish action bar must preserve the selected product object: {required}")
    for required in ("Listing 内容任务", "任务状态分组", "任务详情诊断", "aria-label=\"Listing 内容任务表格\""):
        if required not in CONTENT_TASK_MATRIX:
            errors.append(f"content task matrix must become a seller-console task workbench element: {required}")
    for required in ("Listing标题", "商品描述", "PlatformFieldGroupEditor", "onDraftChange"):
        if required not in BATCH_PUBLISH_PREVIEW:
            errors.append(f"batch publish preview must keep editable listing draft field: {required}")
    for required in ("draft_only", "保存草稿", "立即发布计划", "定时发布计划", "aria-label=\"发布计划模式说明\"", "data-ui=\"publish-plan-mode-guide\""):
        if required not in BATCH_PUBLISH_PREVIEW + BATCH_PUBLISH_WORKSPACE + LISTING_API:
            errors.append(f"batch publish preview must support draft-only/immediate/scheduled publish modes: {required}")
    for required in ("PlatformRealtimePreview", "平台适配实时预览", "Shopee 商品卡", "TEMU 商品卡", "TikTok Shop 商品卡"):
        if required not in BATCH_PUBLISH_PREVIEW:
            errors.append(f"batch publish preview must expose three-platform realtime listing preview: {required}")
    for required in ("PlatformFieldGapDetails", "data-ui=\"platform-field-gap-details\"", "aria-label=\"平台字段结构化缺口\"", "blocking_fields", "recheck_fields", "unified_field_key", "platform_field_name"):
        if required not in BATCH_PUBLISH_PREVIEW + LISTING_API:
            errors.append(f"batch publish preview must expose structured platform field gaps from backend validation details: {required}")
    for required in ("field-gaps-content-link", "platform_field_key", "fieldRepairHref", "encodeURIComponent(field.key)", "/content?"):
        if required not in BATCH_PUBLISH_PREVIEW:
            errors.append(f"batch publish structured field gaps must link back to content factory field repair context: {required}")
    for required in ("searchParams.get('platform_field_key')", "highlightPlatformFieldKey", "highlightedFieldKey", "data-ui=\"platform-field-highlight-target\"", "decodeURIComponent(highlightPlatformFieldKey)"):
        if required not in CONTENT_PLANNER_WORKSPACE + SELLER_PLATFORM_LISTING_EDITOR + PLATFORM_FIELD_GROUPS:
            errors.append(f"content factory must consume platform_field_key and highlight the dynamic platform field: {required}")
    for required in ("草稿结果明细", "平台字段落库诊断", "PlatformFieldGroupSummary"):
        if required not in BATCH_PUBLISH_RESULT:
            errors.append(f"batch publish result step must expose listing draft persistence diagnostics: {required}")
    for required in ("aria-label=\"发布失败与重试处理队列\"", "data-ui=\"publish-result-retry-action-panel\"", "FailureActionCard", "ResultActions", "返回重选重试", "补 Listing 内容", "补图片/SKU", "补定价", "resultRepairHref", "resultPricingHref"):
        if required not in BATCH_PUBLISH_RESULT:
            errors.append(f"batch publish result step must expose failure reasons and repair/retry actions: {required}")
    for required in ("查看商品 Listing", "?tab=listings"):
        if required not in BATCH_PUBLISH_RESULT:
            errors.append(f"batch publish result step must link created drafts back to product listing detail: {required}")
    for required in ("useSearchParams", "product_id", "product_ids", "getProduct", "setSelectedItems"):
        if required not in BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish workspace must keep product detail deep-link support: {required}")
    for required in ("initialTargetsApplied", "productTargetPlatforms", "productTargetMarkets", "matchingStores.length === 1"):
        if required not in BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish workspace must carry product target platform/market context safely: {required}")
    for required in ("toggleItemSelection", "targetStoreIds", "availablePlatformIds", "availableMarketIds", "availableStoreIds", "selectablePlatforms", "selectableMarkets", "setSelectedStores(current =>"):
        if required not in BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish manual item selection must carry known target context: {required}")
    if "不选则按平台默认店铺生成" in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
        errors.append("batch publish must not generate drafts for an implicit default store")
    for required in ("selectedStores.size === 0", "请选择至少一个目标店铺"):
        if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish must require explicit target store selection: {required}")
    for required in ("selectedPlatformsList", "多平台字段组", "platformRequirementsForSelection"):
        if required not in BATCH_PUBLISH_SELECT:
            errors.append(f"batch publish select step must show requirements for every selected platform: {required}")
    for required in ("目标归属", "ItemTargetContext", "商品目标归属", "待选择目标平台/市场/店铺"):
        if required not in BATCH_PUBLISH_SELECT:
            errors.append(f"batch publish select step must show product target context, not only field requirements: {required}")
    for required in ("aria-label=\"发布门禁总览\"", "PublishGateCard", "PublishGateStack", "aria-label=\"发布门禁状态\"", "publishReadiness", "图片门禁", "字段门禁", "目标归属", "Listing 母版", "masterReady"):
        if required not in BATCH_PUBLISH_SELECT:
            errors.append(f"batch publish select step must expose publish gate summary and row diagnostics: {required}")
    for required in ("listingMasterStatus", "ListingMasterSummary", "aria-label=\"统一 Listing 母版摘要\"", "本地 Listing 草稿"):
        if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish select step must expose listing master status before publish: {required}")
    for required in ("ListingMasterStatus", "listing_master_status"):
        if required not in LISTING_API:
            errors.append(f"listing API types must carry backend listing master status: {required}")
    for required in ("listingStoreOverride", "ListingOverrideSummary", "aria-label=\"店铺覆盖字段摘要\"", "未保存店铺覆盖草稿", "SKU", "属性", "物流", "合规"):
        if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish select step must carry store override summary into publish gates: {required}")
    for required in ("StoreOverridePreviewPanel", "aria-label=\"发布预览店铺覆盖来源\"", "店铺覆盖版本", "SKU/变体来源", "物流来源", "合规来源", "平台属性来源", "未使用店铺覆盖版本", "listing_store_override"):
        if required not in BATCH_PUBLISH_PREVIEW + BATCH_PUBLISH_OVERRIDE_PREVIEW + LISTING_API:
            errors.append(f"batch publish preview must expose store override source/status before draft creation: {required}")
    for required in ("field_sources", "override_boundary", "字段来源矩阵", "店铺 Listing 独立覆盖边界"):
        if required not in BATCH_PUBLISH_OVERRIDE_PREVIEW + LISTING_API:
            errors.append(f"batch publish preview must expose field source matrix for store override persistence: {required}")
    for required in ("blocking_validation = [", "check.get(\"state\") == \"block\"", "Listing 发布前校验未通过", "listing_validation.", "test_confirm_publish_rechecks_blocking_validation_before_creating_draft"):
        if required not in BATCH_PUBLISH_SERVICE + (ROOT / "backend/tests/test_business_closure.py").read_text(encoding="utf-8"):
            errors.append(f"batch publish backend must recheck every blocking validation before draft creation: {required}")
    for required in ("confirmed_image_slot_plan", "image_edit_plan", "listing_image_slots.v1", '"image_slots": item.get("image_slots")', "test_batch_preview_uses_confirmed_image_slot_plan"):
        if required not in BATCH_PUBLISH_SERVICE + (ROOT / "backend/app/services/listing_draft_asset_service.py").read_text(encoding="utf-8") + (ROOT / "backend/tests/test_business_closure.py").read_text(encoding="utf-8"):
            errors.append(f"batch publish backend must carry confirmed image_edit_plan slots into draft media assets: {required}")
    if "check.get(\"state\") == \"block\" and check.get(\"code\") == \"platform_fields\"" in BATCH_PUBLISH_SERVICE:
        errors.append("batch publish backend must not only block platform_fields validation failures")
    if "Array.from(selectedPlatforms)[0]" in BATCH_PUBLISH_SELECT:
        errors.append("batch publish select step must not inspect only the first selected platform for field requirements")
    for required in (
        "data-ui=\"publish-target-command-bar\"",
        "aria-label=\"发布目标批量操作条\"",
        "data-ui=\"batch-publish-ready-list-toolbar\"",
        "data-ui=\"batch-publish-ready-list-table\"",
        "data-ui=\"publish-ready-pagination\"",
        "选择本页",
        "商品搜索",
        "发布门禁",
        "目标平台 / 店铺",
        "市场跟随店铺归属",
        "min-w-[1240px]",
        "space-y-4",
    ):
        if required not in BATCH_PUBLISH_SELECT:
            errors.append(f"batch publish select must prioritize product table and responsive target operation bar: {required}")
    for forbidden in (
        "className=\"grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]\"",
        "2xl:grid-cols-[minmax(0,1fr)_360px]",
        "aria-label=\"目标平台店铺操作区\"",
        "onToggleMarket",
        "请选择至少一个目标市场",
    ):
        if forbidden in BATCH_PUBLISH_SELECT:
            errors.append(f"batch publish select must not squeeze the product table with a permanent xl side rail: {forbidden}")
    if "ProductBulkToolbar" not in PRODUCT_EDIT_PAGE and "ProductBulkToolbar" not in PRODUCT_LIST_PAGE:
        errors.append("product list selected toolbar must not regress to empty batch action buttons")
    if "库存待接入" in PRODUCT_BULK_TOOLBAR:
        errors.append("product selected toolbar must not expose stock update as a disabled placeholder")
    for required in ("batchUpdateStock", "stockValue", "onApplyStock", "批量设置店铺库存"):
        if required not in PRODUCT_LIST_PAGE + PRODUCT_BULK_TOOLBAR + PRODUCTS_API:
            errors.append(f"product selected toolbar must support batch store listing stock updates: {required}")
    inventory_alert_content = INVENTORY_ALERT_WORKSPACE + INVENTORY_ALERT_PANELS + INVENTORY_ALERT_API + INVENTORY_ALERT_HOOKS + SYNC_HOOKS + INVENTORY_ALERT_BACKEND_API + INVENTORY_RISK_ACTION_SERVICE
    for required in (
        "InventoryRiskWorkbench",
        "/inventory-alerts/risk-workbench",
        "getInventoryRiskWorkbench",
        "useInventoryRiskWorkbench",
        "InventoryRiskWorkbenchSnapshot",
        "aria-label=\"库存风险处理工作台\"",
        "data-ui=\"inventory-risk-workbench\"",
        "库存资金占用",
        "缺货风险",
        "滞销风险",
        "发货超期风险",
        "库存风险处理队列",
        "buildInventoryRiskLanes",
        "buildInventoryRiskActions",
        "查看店铺商品",
        "复核订单履约",
        "复核运营诊断",
        "createInventorySlowMovingOperationAction",
        "useCreateInventorySlowMovingOperationAction",
        "滞销 Listing 运营动作",
        "生成运营台账动作",
        "/inventory-alerts/risk-workbench/slow-moving/",
        "inventory_risk_action_service",
        "triggerProductSync",
        "同步平台商品库存",
        "平台商品同步未完成",
        "sku_source",
        "v5_product_sku_variants",
        "V5 SKU结构",
    ):
        if required not in inventory_alert_content:
            errors.append(f"inventory alerts must expose platform/store inventory risk workbench: {required}")
    for required in ("基础商品资料列表", "状态诊断", "平台字段诊断", "PlatformFieldGroupSummary", "创建 Listing"):
        if required not in PRODUCT_SELLER_WORKBENCH:
            errors.append(f"product seller workbench must keep seller-console operation element: {required}")
    for required in ("商品机会处理", "诊断动作队列", "aria-label=\"商品机会处理\"", "opportunityActions"):
        if required not in PRODUCT_SELLER_WORKBENCH:
            errors.append(f"product seller workbench must expose opportunity handling diagnostics: {required}")
    if "/content?product_id=${product.id}" not in PRODUCT_SELLER_WORKBENCH:
        errors.append("product seller workbench must carry product_id when drilling into content production")
    if "ProductSellerWorkbench" not in PRODUCT_LIST_PAGE:
        errors.append("product list page must use the seller-console workbench instead of a generic product table")
    for required in ("平台店铺商品", "PlatformStoreProductsPanel", "平台商品同步", "店铺归属", "平台店铺商品库", "基础商品资料", "searchParams.get('tab') === 'master'"):
        if required not in PRODUCT_LIST_PAGE + PLATFORM_STORE_PRODUCTS_PANEL:
            errors.append(f"product module must expose platform store product inventory: {required}")
    for required in ("productListQuery", "productListQuery.isError", "data-ui=\"product-list-error\"", "重新加载商品列表"):
        if required not in PRODUCT_LIST_PAGE:
            errors.append(f"AUDIT-P2-03 product list page must expose visible React Query error recovery: {required}")
    for required in ("productsQuery.isError", "data-ui=\"platform-store-products-error\"", "重新加载平台店铺商品"):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL:
            errors.append(f"AUDIT-P2-03 platform store products panel must expose visible React Query error recovery: {required}")
    for required in ("aria-label=\"平台店铺商品库总览\"", "SummaryCard", "覆盖店铺", "图片不足", "SKU/规格"):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL:
            errors.append(f"platform store products must expose store/listing summary cards: {required}")
    for required in (
        "PlatformStoreGroupingBoard",
        "aria-label=\"平台店铺商品分组态势\"",
        "data-ui=\"platform-store-grouping-board\"",
        "按平台/店铺查看商品同步、图片缺口和 SKU 覆盖",
        "店铺商品数",
        "图片缺口",
        "SKU 覆盖",
        "同步状态",
        "buildPlatformStoreGroups",
    ):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL:
            errors.append(f"platform store products must expose grouped platform/store operating board: {required}")
    for required in (
        "PlatformStoreProductActionStrip",
        "aria-label=\"平台店铺商品处理动作\"",
        "data-ui=\"platform-store-product-action-strip\"",
        "buildStoreProductActions",
        "补主图素材",
        "补 SKU/规格",
        "编辑店铺 Listing",
        "同步状态待处理",
        "查看当前 Listing",
        "action.severity",
    ):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL:
            errors.append(f"platform store product rows must expose row-level next actions and diagnostics: {required}")
    store_context_content = PRODUCT_LIST_PAGE + ORDER_LIST_PAGE + SHIPMENT_LIST_PAGE + FINANCE_PAGE + STORE_CONTEXT_BANNER
    for required in ("StoreContextBanner", "aria-label=\"平台店铺上下文横幅\"", "data-ui=\"store-context-banner\"", "当前按店铺筛选", "store drilldown context", "店铺商品", "店铺订单", "店铺物流", "店铺财务", "清除店铺筛选", "platformAccountId={initialPlatformAccountId}", "platformAccountId={platformAccountId}", "currentModule=\"products\"", "currentModule=\"orders\"", "currentModule=\"shipments\"", "currentModule=\"finance\""):
        if required not in store_context_content:
            errors.append(f"store drilldown context must persist across product/order/finance pages: {required}")
    for required in ("mediaReadinessLabel", "平台图片要求", "媒体缺口", "主档图片"):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API:
            errors.append(f"platform store products must expose listing media readiness and master image context: {required}")
    for required in (
        "aria-label=\"基础商品与店铺 Listing 实例关系\"",
        "对象关系",
        "基础商品 → 店铺 Listing 实例",
        "平台返回ID",
        "主档图片",
        "Listing图片",
        "店铺覆盖字段",
        "标题覆盖",
        "价格/库存覆盖",
        "SKU/规格覆盖",
        "店铺覆盖字段不回写基础商品版本",
        "store_override_summary",
    ):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API + SYNC_SERVICE_BACKEND:
            errors.append(f"platform store product rows must expose product-master to listing-instance relation and store overrides: {required}")
    for required in ("编辑店铺 Listing", "?tab=listings", "listing_id=", "listing_section=", "product_master.id"):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL:
            errors.append(f"platform store products must provide direct listing edit context: {required}")
    for required in ("getPlatformStoreProducts", "triggerProductSync", "platform_products_open_api", "不生成模拟商品"):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API + SYNC_API:
            errors.append(f"platform store products must use real sync boundaries and API wrappers: {required}")
    for required in ("useConfig", "toDomainOptions(platform_listing_statuses)", "platformOptionsFromConfig"):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL:
            errors.append(f"platform store products filters must read runtime platform/listing dictionaries: {required}")
    for forbidden in ("{ value: 'shopee', label: 'Shopee' }", "{ value: 'active', label: '在售' }"):
        if forbidden in PLATFORM_STORE_PRODUCTS_PANEL:
            errors.append(f"platform store products must not hardcode platform or listing status filter options: {forbidden}")
    for required in ("SyncBlockDetail", "下一步：", "operation_details", "待接入"):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL + SYNC_API:
            errors.append(f"platform product sync gap must expose connector detail and next action: {required}")
    for required in ("sync_state", "last_product_sync_status", "last_order_sync_status", "最近商品同步", "最近订单同步"):
        if required not in PLATFORMS_API + PLATFORM_SETTINGS_PAGE:
            errors.append(f"platform settings must expose account-level sync status writeback: {required}")
    for required in ("authorization_status", "authorization", "店铺授权状态", "店铺授权：", "令牌有效期", "权限范围"):
        if required not in PLATFORMS_API + PLATFORM_SETTINGS_PAGE:
            errors.append(f"platform settings must expose OAuth authorization state separately from API key storage: {required}")
    for required in ("updatePlatformAuthorization", "/authorization", "登记店铺 OAuth 授权", "Access Token", "Refresh Token", "保存授权令牌"):
        if required not in PLATFORMS_API + PLATFORM_SETTINGS_PAGE:
            errors.append(f"platform settings must provide a controlled store OAuth token entry path: {required}")
    for required in ("待店铺授权", "授权过期", "授权权限不足", "凭证待验证"):
        if required not in PLATFORM_SETTINGS_PAGE:
            errors.append(f"platform settings status badge must not collapse OAuth states into generic API pending labels: {required}")
    for required in ("record_blocked_sync", "connector_not_ready", "product_sync_blocked", "order_sync_blocked"):
        if required not in SYNC_SERVICE_BACKEND + SYNC_BACKEND_API:
            errors.append(f"platform sync blocked attempts must write failed logs and sync_state: {required}")
    platform_product_adapter_content = f"{PRODUCT_NORMALIZERS}\n{SHOPEE_CLIENT}\n{TIKTOK_CLIENT}\n{TEMU_CLIENT}"
    for required in ("normalize_platform_product", "_normalize_shopee_product", "_normalize_tiktok_product", "_normalize_temu_product", "normalize_product_payload"):
        if required not in platform_product_adapter_content:
            errors.append(f"platform product adapters must normalize raw platform payloads before sync: {required}")
    if "platformRequirementsByPlatform" not in BATCH_PUBLISH_SELECT:
        errors.append("batch publish select step must show product master platform attributes by selected platform")
    for required in ("pricingSourceLabel", "预览读取本地 Listing 草稿"):
        if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish deep-linked products must explain draft pricing source before preview: {required}")
    if "platform_attrs" not in PRODUCT_EDIT_PAGE or "ProductPlatformAttributesPanel" not in PRODUCT_EDIT_PAGE:
        errors.append("product edit page must expose platform-specific product attributes")
    for required in ("ProductEditObjectOverview", "aria-label=\"商品编辑对象总览\"", "data-ui=\"product-edit-object-overview\"", "基础商品版本", "店铺 Listing 实例", "发布准备度", "仅用当前商品真实字段判断", "不回写污染其他店铺"):
        if required not in PRODUCT_EDIT_PAGE:
            errors.append(f"product detail page must show current product object overview before edit sections: {required}")
    for required in ("getProductObjectModel", "/object-model", "ProductObjectModelSnapshot"):
        if required not in PRODUCTS_API + PRODUCT_EDIT_PAGE:
            errors.append(f"product detail page must consume V5 product object model snapshot: {required}")
    for required in ("useProductObjectModel", "data-ui=\"product-v5-object-model-summary\"", "data-ui=\"product-v5-object-model-gaps\"", "基础版本", "V5 SKU", "字段缺口"):
        if required not in PRODUCT_EDIT_PAGE:
            errors.append(f"product detail page must expose V5 object model state: {required}")
    for required in ("useSearchParams", "initialTab", "initialListingSection", "ProductEditSectionNav", "aria-label=\"商品编辑字段快速定位\"", "ProductEditSection", "scrollIntoView", "product-section-${initialTab}"):
        if required not in PRODUCT_EDIT_PAGE:
            errors.append(f"product detail page must use route-driven quick定位 and continuous sections: {required}")
    for forbidden in ("<Tabs tabs={FORM_TABS}", "setActiveTab(initialTab)", "activeTab === 'basic'", "activeTab === 'listings'"):
        if forbidden in PRODUCT_EDIT_PAGE:
            errors.append(f"product detail page must not split one product into mutually exclusive tabs: {forbidden}")
    if "图片”页签" in PRODUCT_DETAIL_TABS:
        errors.append("product listing panel must refer to product image section, not image tab")
    for required in ("发布计划", "平台未尝试发布", "listingPublishPlanText"):
        if required not in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing panel must expose local publish plan and platform publish boundary: {required}")
    for required in ("店铺级 Listing 编辑", "当前编辑店铺 Listing", "updateListingOverrides", "保存店铺覆盖", "SKU/变体"):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing panel must support store-level listing instance editing: {required}")
    for required in ("promoteListingToBaseVersion", "promote-base-version", "生成新基础版本", "显式反哺动作"):
        if required not in PRODUCT_DETAIL_TABS + LISTING_API:
            errors.append(f"product listing panel must make base-version promotion explicit: {required}")
    for required in ("SKU 变体结构化编辑", "variantRows", "添加变体", "删除变体"):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must use structured fields instead of raw JSON: {required}")
    for required in ("LISTING_EDIT_SECTIONS", "listingEditSection", "基础信息", "商品详情", "销售资料/SKU", "媒体素材", "物流与发布", "平台属性"):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must use seller-center style section tabs: {required}")
    for required in (
        "ListingInlineSectionNavigator",
        "aria-label=\"Listing 字段快速定位\"",
        "data-ui=\"listing-inline-section-navigator\"",
        "aria-label=\"当前 Listing 连续编辑分区\"",
        "data-ui=\"listing-continuous-edit-sections\"",
        "scrollIntoView",
        "initialSection",
        "listing_section",
        "requestedSection",
        "listing-section-basic",
        "listing-section-detail",
        "listing-section-sales",
        "listing-section-media",
        "listing-section-logistics",
        "listing-section-attributes",
        "不是 Tab 分页，点击后定位到同一商品的对应字段分区",
    ):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must render continuous same-product sections with quick anchors: {required}")
    for forbidden in ("listingEditSection === 'basic'", "listingEditSection === 'detail'", "listingEditSection === 'sales'", "listingEditSection === 'media'", "listingEditSection === 'logistics'", "listingEditSection === 'attributes'"):
        if forbidden in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must not split one listing into conditional tab pages: {forbidden}")
    for required in ("TikTok：最多 9 张图", "Shopee/妙手：图片、视频、物流、货源链接同一商品上下文维护", "当前店铺覆盖"):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must explain platform listing edit constraints: {required}")
    for required in ("店铺视频 URL", "货源链接", "包裹重量", "包裹长宽高", "shipping_config", "video_url", "source_url"):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT + LISTING_API:
            errors.append(f"product listing editor must persist media/source/logistics store overrides: {required}")
    for required in ("publish_plan", "定时发布时间", "本地发布计划"):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT + LISTING_API:
            errors.append(f"product listing editor must persist local publish plan store overrides: {required}")
    for forbidden in ("promotion_config", "促销活动名称", "店铺促销配置", "buildPromotionConfig", "listingPromotionValue"):
        if forbidden in PRODUCT_LISTING_EDITOR_CONTENT + LISTING_API:
            errors.append(f"promotion discount must not be edited as listing override: {forbidden}")
    promotion_module_content = "\n".join(
        [
            PROMOTIONS_PAGE,
            PROMOTIONS_API,
            PROMOTIONS_BACKEND_API,
            PROMOTION_SERVICE,
            PROMOTION_MODEL,
            MODULE_SUBNAV,
            NAVIGATION,
        ]
    )
    for required in ("PromotionCampaign", "PromotionCampaignItem", "promotion_campaigns", "promotion_campaign_items", "/promotions"):
        if required not in promotion_module_content:
            errors.append(f"promotion discounts must be independent campaign objects: {required}")
    for required in ("促销活动", "活动名称/ID", "所属店铺", "活动产品", "添加产品", "修改折扣", "一个活动归属于一个平台店铺，可以包含多个参与商品"):
        if required not in promotion_module_content:
            errors.append(f"promotion module must expose seller-center campaign list semantics: {required}")
    for required in ("活动效果", "PromotionEffectSummary", "price_summary", "discount_amount_total", "original_price_total", "promotion_price_total", "promotion_campaign_items", "平台 Open API 未接通前不代表真实成交效果"):
        if required not in promotion_module_content:
            errors.append(f"promotion module must expose local promotion price impact without fake platform performance: {required}")
    for required in ("PromotionCreateFormState", "showCreate", "handleCreateCampaign", "选择参与商品", "selectedListingIds", "createPromotionCampaign", "getPlatformStoreProducts"):
        if required not in promotion_module_content:
            errors.append(f"promotion module must support local campaign creation with multiple listings: {required}")
    for required in ("handleEndCampaign", "updatePromotionCampaignStatus", "结束活动", "promotion_platform_sync"):
        if required not in promotion_module_content:
            errors.append(f"promotion module must support local campaign state actions without fake platform sync: {required}")
    for required in ("startCampaignAction", "handleAddItemsToCampaign", "handleUpdateCampaignDiscount", "addPromotionCampaignItems", "updatePromotionCampaignDiscount", "追加参与商品"):
        if required not in promotion_module_content:
            errors.append(f"promotion module must support adding items and changing campaign discounts: {required}")
    for required in ("handleUpdateCampaign", "updatePromotionCampaign", "叠加规则", "保存活动"):
        if required not in promotion_module_content:
            errors.append(f"promotion module must support editing campaign basic info without touching listings: {required}")
    for required in ("handleSyncCampaign", "syncPromotionCampaign", "promotion_open_api.not_implemented"):
        if required not in promotion_module_content:
            errors.append(f"promotion module must expose platform sync gap without fake success: {required}")
    for required in ("useConfirm", "confirmAction", "结束促销活动", "同步促销活动", "确认结束", "确认同步"):
        if required not in PROMOTIONS_PAGE:
            errors.append(f"promotion high-risk actions must use system confirm dialog: {required}")
    for required in ("按三平台字段组编辑", "PlatformFieldGroupEditor", "selectedListingRequirements", "field_groups", "平台字段组编辑"):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must render platform field group form: {required}")
    for required in ("listing-inline-ai-title", "listing-inline-ai-description", "applyTitleCandidate", "applyDescriptionCandidate"):
        if required not in SELLER_PLATFORM_LISTING_EDITOR:
            errors.append(f"content factory AI assistance must be embedded beside concrete listing fields: {required}")
    if "AI 辅助动作" in SELLER_PLATFORM_LISTING_EDITOR:
        errors.append("content factory must not keep a standalone AI assistance card in the Listing editor")
    for required in ("override_image_urls", "override_sku_rows", "image_slots", "sku_rows", "package_size", "platform_attributes", "boundary"):
        if required not in LISTING_STORE_OVERRIDE_SERVICE + SELLER_PLATFORM_LISTING_EDITOR:
            errors.append(f"listing store override must bridge V5 editor payload into publish/readiness services: {required}")
    for required in ("platform_sku", "spu_skc", "sku_image_role", "weight_g", "option_2_value", "test_listing_store_override_supports_v5_editor_payload"):
        if required not in LISTING_STORE_OVERRIDE_SERVICE + (ROOT / "backend/app/services/listing_draft_asset_service.py").read_text(encoding="utf-8") + (ROOT / "backend/tests/test_listing_store_override_compat.py").read_text(encoding="utf-8"):
            errors.append(f"listing SKU plan must preserve seller-console SKU fields into publish payload: {required}")
    for required in (
        "default_unified_field_dictionary.json",
        "get_unified_field_dictionary",
        "unified_field_dictionary",
        "FIELD_KEY_ALIASES",
        "unified_field_key",
        "platform_field_name",
        "miaoshou_field_name",
        "FieldMetaHint",
        "product_title",
        "clear_image_status",
    ):
        if required not in CONFIG_SERVICE + CONFIG_API + USE_CONFIG_HOOK + PLATFORM_FIELD_GROUPS + UNIFIED_FIELD_DICTIONARY:
            errors.append(f"FIELD-V5-P0-01 must keep unified CSV field dictionary and dynamic field metadata: {required}")
    for required in (
        "ProductListingEditOverview",
        "aria-label=\"当前商品编辑总览\"",
        "当前商品编辑总览",
        "基础商品主档",
        "平台店铺 Listing 上下文",
        "图片素材槽位",
        "SKU/规格矩阵",
        "平台属性进度",
        "价格库存状态",
        "data-ui=\"product-listing-edit-overview\"",
        "CurrentListingInstanceCommandPanel",
        "aria-label=\"当前店铺 Listing 实例操作台\"",
        "当前店铺 Listing 实例",
        "平台返回ID",
        "店铺覆盖隔离",
        "图片槽位",
        "价格库存",
        "SKU/规格",
        "平台字段",
        "物流发布",
        "保存只更新当前 Listing",
        "listingInstanceReadiness",
    ):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must expose current listing instance command panel for deep-linked listing edits: {required}")
    for required in (
        "PlatformListingSellerPreview",
        "aria-label=\"卖家后台 Listing 预览与字段核对\"",
        "data-ui=\"platform-listing-seller-preview\"",
        "id=\"platform-listing-seller-preview\"",
        "买家搜索卡片预览",
        "后台关键字段核对",
        "主图",
        "标题",
        "价格",
        "库存",
        "SKU",
        "平台属性",
        "物流",
        "发布前请逐项核对",
        "sellerPreviewChecks",
    ):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must show seller-backend preview and publish field checks: {required}")
    for required in ("ListingFieldEvidencePanel", "平台字段补证队列", "类目待补证字段", "编辑页待补证字段", "接口待补证字段", "补证后再发布", "platformFieldEvidenceGaps"):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must expose category/edit-page/API field recheck gaps: {required}")
    for required in ("类目差异字段组", "category_profile", "matched_category", "补证字段"):
        if required not in PLATFORM_FIELD_GROUPS:
            errors.append(f"platform field groups must show matched category profile and gap count: {required}")
    for forbidden in ("attributeRows", "平台属性结构化编辑", "添加属性", "删除属性", "toAttributeRows", "updateAttributeRow"):
        if forbidden in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must not use generic key/value platform attributes: {forbidden}")
    for required in ("从商品图片选择", "商品主档已入库图片", "toggleListingImage", "使用主档图片", "selectedListingImageSet"):
        if required not in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must reuse ingested product images: {required}")
    for forbidden in ("SKU/变体 JSON", "平台属性 JSON", "parseJsonArray", "parseJsonObject"):
        if forbidden in PRODUCT_LISTING_EDITOR_CONTENT:
            errors.append(f"product listing editor must not expose raw JSON editing: {forbidden}")
    for required in ("aria-label=\"商品图片真实预览\"", "主图", "辅图", "至少 5 张", "建议 9 张", "上移", "下移", "删除图片"):
        if required not in PRODUCT_IMAGES_PANEL:
            errors.append(f"product image editor must support platform-grade image management: {required}")
    for required in ("mediaReadinessForProduct", "图片就绪", "平台至少 5 张", "建议 9 张", "媒体缺口"):
        if required not in PRODUCT_SELLER_WORKBENCH:
            errors.append(f"product seller workbench must surface platform image readiness in the list and inspector: {required}")
    for required in ("上传商品图片", "采集图片入库", "素材入库后自动写入图片列表", "uploadProductImage", "importProductImageUrl"):
        if required not in PRODUCT_IMAGES_PANEL + PRODUCTS_API:
            errors.append(f"product image editor must persist image assets instead of manual URL only: {required}")
    if "aria-label=\"三平台商品属性\"" not in PRODUCT_PLATFORM_ATTRIBUTES_PANEL:
        errors.append("product platform attributes panel must expose runtime platform attribute editing")
    for required in ("useConfirm", "删除商品主档", "确认删除", "selectedIds.size"):
        if required not in PRODUCT_LIST_PAGE:
            errors.append(f"product bulk delete must use system confirm dialog: {required}")
    for required in ("useConfirm", "删除平台店铺配置", "确认删除店铺"):
        if required not in PLATFORM_SETTINGS_PAGE:
            errors.append(f"platform account delete must use system confirm dialog: {required}")
    for required in ("useConfirm", "删除仓储配置", "确认删除仓储"):
        if required not in SETTINGS_SYSTEM_PANELS:
            errors.append(f"settings warehouse delete must use system confirm dialog: {required}")
    for required in ("补录平台账单", "entry_type=platform_fee", "order_id=${order.id}"):
        if required not in ORDER_DETAIL_PAGE:
            errors.append(f"order detail platform bill gap must deep-link to finance ledger replenishment: {required}")
    for required in ("财务入账状态", "finance_entry_context", "OrderFinanceEntryPanel", "关联流水", "销售收入", "订单净利", "view_order_ledger", "record_sales_income", "build_order_finance_entry_context", "FinanceLedgerEntry.order_id == order.id"):
        if required not in ORDER_DETAIL_PAGE + ORDER_TYPES + ORDER_SERVICE:
            errors.append(f"order detail must expose real finance ledger posting context: {required}")
    for required in ("order_id: Optional[str] = None", "FinanceLedgerEntry.order_id == order_id", "order_id: initialOrderId || undefined"):
        if required not in FINANCE_API + FINANCE_SERVICE + FINANCE_LEDGER_PANEL:
            errors.append(f"finance ledger must support order-level drilldown filtering: {required}")
    for required in ("同步复盘", "platform_sync_status", "平台同步复盘", "platform_sync_review", "最近店铺订单同步"):
        if required not in ORDER_LIST_PAGE + ORDER_DETAIL_PAGE:
            errors.append(f"orders pages must expose platform order sync review context: {required}")
    for required in ("useTriggerSync", "同步当前店铺订单", "syncMutation.mutate(order.platform_account_id)", "syncMutation.isPending", "qc.invalidateQueries({ queryKey: ['order'] })"):
        if required not in ORDER_DETAIL_PAGE + USE_SYNC_HOOK:
            errors.append(f"order detail must provide a real store order sync action from sync review: {required}")
    for required in ("platform_account_id", "platformAccountId", "StoreContextBanner", "currentModule=\"orders\"", "store-context-banner"):
        if required not in ORDER_LIST_PAGE + ORDERS_API + STORE_CONTEXT_BANNER:
            errors.append(f"orders page must keep cockpit store drilldown filter context: {required}")
    for required in ("履约异常", "履约异常复盘", "fulfillment_exception", "shipping_overdue", "异常处理动作闭环", "create_shipment", "review_after_sales", "replenish_platform_bill"):
        if required not in ORDER_LIST_PAGE + ORDER_DETAIL_PAGE + ORDER_SERVICE:
            errors.append(f"orders pages must expose fulfillment exception queue context: {required}")
    for required in ("exceptions: exceptionMode ? '1' : undefined", "exceptions: bool = Query(False", "exceptions: bool = False", "fulfillment_context = build_fulfillment_exception_context(order)", "fulfillment_context.get(\"status\") == \"clear\"", "当前筛选范围没有履约异常订单"):
        if required not in ORDER_LIST_PAGE + ORDERS_API + ORDER_API + ORDER_SERVICE:
            errors.append(f"orders exception filter must use fulfillment exception context instead of order status: {required}")
    for required in ("fulfillment_exception_status", "sync_status", "shipping_sla", "_matches_shipping_sla", "data-ui=\"order-fulfillment-filter-bar\"", "shippingSlaLabel"):
        if required not in ORDER_LIST_PAGE + ORDERS_API + ORDER_API + ORDER_SERVICE:
            errors.append(f"orders list must expose sync status, exception status and shipping SLA filters: {required}")
    for required in ("RelatedShipmentsPanel", "关联物流记录", "useShipmentList", "order_id", "新增物流", "本地物流渠道"):
        if required not in ORDER_DETAIL_PAGE + SHIPMENTS_API:
            errors.append(f"order detail must show related shipment records: {required}")
    for required in ("订单履约运营总览", "OrderFulfillmentOverview", "useOrderStats", "/orders/stats", "pending_shipment", "due_soon", "overdue", "store_breakdown", "缺失字段进入数据缺口"):
        if required not in ORDER_LIST_PAGE + ORDERS_API + ORDER_SERVICE + USE_ORDERS_HOOK:
            errors.append(f"orders page must expose fulfillment operating overview: {required}")
    for required in ("orderListQuery", "orderStatsQuery.isError", "data-ui=\"order-list-error\"", "data-ui=\"order-stats-error\"", "重新加载订单列表", "重新加载履约统计"):
        if required not in ORDER_LIST_PAGE:
            errors.append(f"AUDIT-P2-03 orders page must expose visible React Query error recovery: {required}")
    for required in ("useOrder", "order.after_sales_status", "履约异常原因", "不生成模拟售后记录"):
        if required not in AFTER_SALES_PAGE:
            errors.append(f"after-sales page must show linked order context without fake platform tickets: {required}")
    for required in ("AfterSalesFulfillmentAnalysis", "售后履约分析", "退款/扣款台账", "finance_entry_context", "entry_type=refund", "平台售后单", "接口待接入", "不生成模拟售后记录"):
        if required not in AFTER_SALES_PAGE:
            errors.append(f"after-sales page must analyze fulfillment and finance context without fake after-sales tickets: {required}")
    for required in ("OrderShipmentContextPanel", "订单发货上下文", "useOrder(orderContextId)", "平台发货时限", "买家与收货地址", "返回订单详情", "shippingAddressText"):
        if required not in SHIPMENT_DETAIL_PAGE:
            errors.append(f"shipment creation page must carry order fulfillment context: {required}")
    for required in ("ShipmentStatusLifecycle", "物流状态轨迹", "物流状态字典轨迹", "基于系统物流状态字典", "承运商真实轨迹", "当前阶段", "已推进", "待推进", "当前物流状态未在统一字典中配置"):
        if required not in SHIPMENT_DETAIL_PAGE:
            errors.append(f"shipment detail must show local shipment status lifecycle separately from carrier tracking events: {required}")
    for required in ("平台/店铺", "order_number", "buyer_name", "fulfillment_deadline_at", "platform_account_name", "平台时限待同步"):
        if required not in SHIPMENT_LIST_PAGE + SHIPMENT_DETAIL_PAGE + SHIPMENT_SERVICE:
            errors.append(f"shipment pages must expose platform-store-order context: {required}")
    for required in ("platform_account_id", "platformAccountId", "StoreContextBanner", "currentModule=\"shipments\"", "店铺物流"):
        if required not in SHIPMENT_LIST_PAGE + SHIPMENTS_API + SHIPMENT_SERVICE + STORE_CONTEXT_BANNER:
            errors.append(f"shipment list must keep platform store drilldown filters: {required}")
    for required in ("_sync_order_local_shipment_context", "local_shipment_context", "logistics_channel_source", "tracking_number_source", "local_shipment"):
        if required not in SHIPMENT_SERVICE:
            errors.append(f"shipment service must mirror real local shipment context back to order fulfillment: {required}")
    for required in ("_advance_order_status_from_shipment", "terminal_statuses", "ready_to_ship", "order.status = \"shipped\"", "order.status = \"delivered\""):
        if required not in SHIPMENT_SERVICE:
            errors.append(f"shipment service must safely advance non-terminal order status from local shipment: {required}")
    for required in ("fulfillment_exception", "/orders?exceptions=1", "物流时效风险", "estimated_impact", "response_deadline_at", "remaining_time_label", "sla_hours"):
        if required not in RISK_CONTROL_SERVICE:
            errors.append(f"risk control must reuse order fulfillment exception context: {required}")
    for required in ("business", "店铺经营风险", "投入未转化", "spend-no-sales", "cost_rmb", "order_count"):
        if required not in RISK_CONTROL_SERVICE:
            errors.append(f"risk control must generate concrete store operating risks from store matrix: {required}")
    for required in ("traffic-no-order", "traffic_no_order", "views_30d", "orders_30d", "listing_id", "Listing/定价/主图失效"):
        if required not in RISK_CONTROL_SERVICE:
            errors.append(f"risk control must generate concrete listing no-sales operating risks from product operations: {required}")
    for required in ("business:sales-decline", "previous_orders_30d", "previous_sales_amount_30d", "orders_30d", "sales_amount_30d", "销售急剧下滑"):
        if required not in RISK_CONTROL_SERVICE + RISK_CONTROL_SALES_RISK_SERVICE:
            errors.append(f"risk control must generate concrete listing sales-decline risks only from real platform comparison metrics: {required}")
    for required in ("get_finance_summary", "_finance_signal_risks", "finance:{code}", "真实财务台账", "finance_signal_code", "action_label"):
        if required not in RISK_CONTROL_SERVICE:
            errors.append(f"risk control must convert backend finance risk_signals into risk events: {required}")
    risk_source_content = RISK_CONTROL_SERVICE + RISK_CONTROL_SOURCE_SUMMARY_SERVICE
    for required in ("get_order_stats", "build_risk_source_summary", "risk_source_summary", "履约超时", "库存断货", "利润异常", "shipping_sla=overdue"):
        if required not in risk_source_content:
            errors.append(f"risk control must summarize fulfillment/inventory/profit risk sources: {required}")
    for required in ("operation-action", "createRiskOperationAction", "生成运营台账动作", "operationSaving"):
        if required not in RISK_CONTROL_API + RISK_CONTROL_WORKSPACE + RISK_ACTION_PANEL:
            errors.append(f"risk control must create operation ledger actions from concrete risk events: {required}")
    for required in ("record_type", "searchParams.get('record_type')", "listOperationRecords(requestedType"):
        if required not in OPERATIONS_WORKSPACE:
            errors.append(f"operations workspace must accept risk-control record_type deep links: {required}")
    for required in ("allowsZeroBudgetOperationRecord", "listing_optimization", "0 预算 Listing 优化动作"):
        if required not in OPERATIONS_WORKSPACE:
            errors.append(f"operations workspace must allow zero-budget listing optimization records from risk/product diagnostics: {required}")
    for required in ("initialOrderId", "order_id", "关联订单ID"):
        if required not in FINANCE_LEDGER_PANEL + FINANCE_PAGE:
            errors.append(f"finance ledger panel must accept order_id from query for platform bill replenishment: {required}")
    for required in ("initialPlatformAccountId", "platform_account_id", "StoreContextBanner", "currentModule=\"finance\"", "store-context-banner"):
        if required not in FINANCE_LEDGER_PANEL + FINANCE_PAGE + FINANCE_API + STORE_CONTEXT_BANNER:
            errors.append(f"finance page must keep cockpit store drilldown filter context: {required}")
    for required in (
        "getFinanceSummary(period, { platform_account_id: platformAccountId || undefined })",
        "getFinanceTraceback(period, { platform_account_id: platformAccountId || undefined })",
        "get_finance_summary(db, current_user.id, period, platform_account_id=platform_account_id)",
        "get_finance_traceback(db, current_user.id, period, platform_account_id=platform_account_id)",
        "FinanceLedgerEntry.extra[\"platform_account_id\"].as_string() == platform_account_id",
        "_latest_cash_balance(db, user_id, platform_account_id=platform_account_id, as_at=now)",
        "finance_ledger_entries.store_scope",
    ):
        if required not in FINANCE_PAGE + FINANCE_API + FINANCE_SERVICE + FINANCE_BACKEND_API:
            errors.append(f"finance store drilldown must filter summary, traceback and cash balance, not only ledger rows: {required}")
    for required in (
        "useQuery",
        "financeSummaryQuery",
        "financeTracebackQuery",
        "queryKey: ['finance-summary'",
        "queryKey: ['finance-traceback'",
        "data-ui=\"finance-summary-error\"",
        "data-ui=\"finance-traceback-error\"",
        "重新加载财务汇总",
        "重新加载利润回溯",
    ):
        if required not in FINANCE_PAGE:
            errors.append(f"AUDIT-P2-03 finance page must use React Query boundaries and visible error recovery: {required}")
    for required in ("平台账单批量导入", "importPlatformBills", "/finance/platform-bills/import", "import_ref 用于去重"):
        if required not in FINANCE_PAGE + FINANCE_API:
            errors.append(f"finance page must expose platform bill batch import workflow: {required}")
    for required in ("Open API 同步", "syncPlatformBills", "/finance/platform-bills/sync", "账单API待接入", "Open API 暂不可用"):
        if required not in FINANCE_PAGE + FINANCE_API:
            errors.append(f"finance page must expose truthful platform bill Open API sync workflow: {required}")
    for required in ("risk_signals", "FinanceRiskSignal", "_finance_risk_signals", "收入台账未入账", "成本台账不完整", "平台费缺失", "资金余额未录入", "negative_profit", "action_route"):
        if required not in FINANCE_PAGE + FINANCE_API + FINANCE_SERVICE + FINANCE_SCHEMA:
            errors.append(f"finance risks must come from backend reusable summary signals, not local page heuristics: {required}")
    for required in ("financial_risk_signals", "ReportFinancialRiskPanel", "报表财务风险", "get_finance_summary", "_report_bounds", "finance_risk_count", "ReportFinancialRiskSignal"):
        if required not in REPORT_SERVICE + REPORT_DISPLAY + REPORT_TYPES:
            errors.append(f"reports must reuse backend finance risk signals and display them in report output: {required}")
    for required in ("financial_risk", "财务风险异常", "report-finance-anomaly-list", "financeRisks", "metricAnomalies", "action_route"):
        if required not in REPORT_SERVICE + REPORT_PANELS + REPORT_TYPES:
            errors.append(f"report anomaly detection must show finance risk anomalies separately from numeric deviations: {required}")
    for required in ("商品运营诊断", "getProductOperationMetrics", "/operations/product-metrics", "conversion_rate_pct", "生成运营台账", "createProductOperationAction", "/operations/product-actions"):
        if required not in GROWTH_ENGINE_PAGE + OPERATIONS_API:
            errors.append(f"growth engine must expose product-level operation metrics and diagnostics: {required}")
    for required in (
        "useQuery",
        "growthOpportunityQuery",
        "growthMetricsQuery",
        "queryKey: ['growth-opportunities']",
        "queryKey: ['growth-product-metrics']",
        "data-ui=\"growth-opportunity-error\"",
        "data-ui=\"growth-metrics-error\"",
        "重新加载增长机会",
        "重新加载运营指标",
    ):
        if required not in GROWTH_ENGINE_PAGE:
            errors.append(f"AUDIT-P2-03 growth engine must use React Query boundaries and visible error recovery: {required}")
    for required in (
        "reportDailyQuery",
        "reportWeeklyQuery",
        "reportMonthlyQuery",
        "reportSubscriptionsQuery",
        "data-ui=\"report-daily-error\"",
        "data-ui=\"report-weekly-error\"",
        "data-ui=\"report-monthly-error\"",
        "data-ui=\"report-subscriptions-error\"",
        "重新加载日报",
        "重新加载周报",
        "重新加载月报",
        "重新加载订阅",
    ):
        if required not in REPORT_PANELS:
            errors.append(f"AUDIT-P2-03 reports center must expose visible React Query error recovery: {required}")
    for required in (
        "aiSuggestionsQuery",
        "aiSuggestionsQuery.isError",
        "data-ui=\"ai-suggestions-error\"",
        "重新加载 AI 建议",
    ):
        if required not in AI_SUGGESTIONS_PAGE:
            errors.append(f"AUDIT-P2-03 AI suggestions page must expose visible React Query error recovery: {required}")
    for required in (
        "competitorDashboardQuery",
        "competitorDashboardQuery.isError",
        "data-ui=\"competitor-dashboard-error\"",
        "重新加载竞品监控",
    ):
        if required not in COMPETITOR_MONITOR_PAGE:
            errors.append(f"AUDIT-P2-03 competitor monitor page must expose visible React Query error recovery: {required}")
    for required in (
        "auditLogsQuery",
        "auditLogsQuery.isError",
        "data-ui=\"audit-log-error\"",
        "重新加载审计日志",
    ):
        if required not in AUDIT_LOG_TAB:
            errors.append(f"AUDIT-P2-03 audit log tab must expose visible React Query error recovery: {required}")
    for required in (
        "alertRulesQuery",
        "alertRulesQuery.isError",
        "data-ui=\"inventory-alert-rules-error\"",
        "重新加载预警规则",
    ):
        if required not in INVENTORY_ALERT_PANELS:
            errors.append(f"AUDIT-P2-03 inventory alert rules tab must expose visible React Query error recovery: {required}")
    for required in (
        "alertLogsQuery",
        "alertLogsQuery.isError",
        "data-ui=\"inventory-alert-logs-error\"",
        "重新加载预警历史",
    ):
        if required not in INVENTORY_ALERT_PANELS:
            errors.append(f"AUDIT-P2-03 inventory alert history tab must expose visible React Query error recovery: {required}")
    for required in (
        "seedListError",
        "dictionaryError",
        "data-ui=\"trend-seed-list-error\"",
        "data-ui=\"trend-seed-dictionary-error\"",
        "重新加载种子词",
        "重新加载字典",
    ):
        if required not in SEED_MANAGER_TAB:
            errors.append(f"AUDIT-P2-03 trend seed manager must expose visible error recovery: {required}")
    for required in (
        "accessControlError",
        "data-ui=\"access-control-error\"",
        "重新加载权限授权",
    ):
        if required not in SETTINGS_ACCESS_PANEL:
            errors.append(f"AUDIT-P2-03 access control settings must expose visible error recovery: {required}")

    return errors


if __name__ == "__main__":
    failures = validate()
    if failures:
        raise SystemExit("\n".join(failures))
    print("Validated frontend information architecture")

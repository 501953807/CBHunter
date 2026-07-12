#!/usr/bin/env python3
"""Validate module navigation and settings information architecture."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SRC = ROOT / "frontend/src"
NATIVE_CONFIRM_ALLOWLIST = {
    "frontend/src/components/ui/ConfirmDialog.tsx",
}
MODULE_SUBNAV = (ROOT / "frontend/src/components/layout/ModuleSubnav.tsx").read_text(encoding="utf-8")
SIDEBAR = (ROOT / "frontend/src/components/layout/Sidebar.tsx").read_text(encoding="utf-8")
NAVIGATION = (ROOT / "frontend/src/components/layout/navigation.ts").read_text(encoding="utf-8")
ROUTE_META = (ROOT / "frontend/src/components/layout/routeMeta.ts").read_text(encoding="utf-8")
SETTINGS_WORKSPACE = (ROOT / "frontend/src/features/settings/SettingsWorkspace.tsx").read_text(encoding="utf-8")
SETTINGS_ACCOUNT_PANELS = (ROOT / "frontend/src/features/settings/SettingsAccountPanels.tsx").read_text(encoding="utf-8")
SETTINGS_SYSTEM_PANELS = (ROOT / "frontend/src/features/settings/SettingsSystemPanels.tsx").read_text(encoding="utf-8")
HEADER = (ROOT / "frontend/src/components/layout/Header.tsx").read_text(encoding="utf-8")
SCOUT_WORKSPACE = (ROOT / "frontend/src/features/scout-sources/ScoutSourcesWorkspace.tsx").read_text(encoding="utf-8")
SELECTION_PIPELINE = (ROOT / "frontend/src/components/shared/SelectionBusinessPipeline.tsx").read_text(encoding="utf-8")
BUSINESS_FLOW_V2 = (ROOT / "frontend/src/features/business-flow/BusinessFlowV2Board.tsx").read_text(encoding="utf-8")
BUSINESS_FLOW_CONTEXT_RAIL = (ROOT / "frontend/src/features/business-flow/BusinessFlowContextRail.tsx").read_text(encoding="utf-8")
BUSINESS_FLOW_ROUTES = (ROOT / "frontend/src/features/business-flow/businessFlowRoutes.ts").read_text(encoding="utf-8")
RISK_CONTROL_WORKSPACE = (ROOT / "frontend/src/features/risk-control/RiskControlWorkspace.tsx").read_text(encoding="utf-8")
RISK_SIGNAL_BOARD = (ROOT / "frontend/src/features/risk-control/RiskSignalBoard.tsx").read_text(encoding="utf-8")
RISK_EVIDENCE_PANEL = (ROOT / "frontend/src/features/risk-control/RiskEvidencePanel.tsx").read_text(encoding="utf-8")
COCKPIT_WORKSPACE = (ROOT / "frontend/src/features/cockpit/CockpitWorkspace.tsx").read_text(encoding="utf-8")
COCKPIT_CENTER_SUMMARY = (ROOT / "frontend/src/features/cockpit/CockpitCenterSummaryPanels.tsx").read_text(encoding="utf-8")
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
CONTENT_MEDIA_STUDIO = (ROOT / "frontend/src/features/content-planner/ContentMediaStudio.tsx").read_text(encoding="utf-8")
CONTENT_PLANNER_WORKSPACE = (ROOT / "frontend/src/features/content-planner/ContentPlannerWorkspace.tsx").read_text(encoding="utf-8")
CONTENT_PUBLISH_GUIDE = (ROOT / "frontend/src/features/content-planner/ContentPublishGuide.tsx").read_text(encoding="utf-8")
CONTENT_PRODUCT_QUEUE = (ROOT / "frontend/src/features/content-planner/ContentProductQueue.tsx").read_text(encoding="utf-8")
CONTENT_TASK_MATRIX = (ROOT / "frontend/src/features/content-planner/ContentTaskMatrix.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_PREVIEW = (ROOT / "frontend/src/features/batch-publish/BatchPublishPreviewStep.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_QUEUE = (ROOT / "frontend/src/features/batch-publish/ListingDraftQueue.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_COMPLETENESS = (ROOT / "frontend/src/features/batch-publish/ListingCompletenessPanel.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_RESULT = (ROOT / "frontend/src/features/batch-publish/BatchPublishResultStep.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_WORKSPACE = (ROOT / "frontend/src/features/batch-publish/BatchPublishWorkspace.tsx").read_text(encoding="utf-8")
BATCH_PUBLISH_SELECT = (ROOT / "frontend/src/features/batch-publish/BatchPublishSelectStep.tsx").read_text(encoding="utf-8")
PRODUCT_EDIT_PAGE = (ROOT / "frontend/src/pages/ProductEditPage.tsx").read_text(encoding="utf-8")
PRODUCT_DETAIL_TABS = (ROOT / "frontend/src/features/products/ProductDetailTabs.tsx").read_text(encoding="utf-8")
PRODUCT_IMAGES_PANEL = (ROOT / "frontend/src/features/products/ProductImagesPanel.tsx").read_text(encoding="utf-8")
PLATFORM_FIELD_GROUPS = (ROOT / "frontend/src/components/shared/PlatformFieldGroups.tsx").read_text(encoding="utf-8")
PLATFORM_STORE_PRODUCTS_PANEL_PATH = ROOT / "frontend/src/features/products/PlatformStoreProductsPanel.tsx"
PLATFORM_STORE_PRODUCTS_PANEL = PLATFORM_STORE_PRODUCTS_PANEL_PATH.read_text(encoding="utf-8") if PLATFORM_STORE_PRODUCTS_PANEL_PATH.exists() else ""
PRODUCT_PLATFORM_ATTRIBUTES_PANEL = (ROOT / "frontend/src/features/products/ProductPlatformAttributesPanel.tsx").read_text(encoding="utf-8")
PRODUCT_LIST_PAGE = (ROOT / "frontend/src/pages/ProductListPage.tsx").read_text(encoding="utf-8")
PRODUCT_BULK_TOOLBAR = (ROOT / "frontend/src/features/products/ProductBulkToolbar.tsx").read_text(encoding="utf-8")
ORDER_LIST_PAGE = (ROOT / "frontend/src/pages/OrderListPage.tsx").read_text(encoding="utf-8")
ORDER_DETAIL_PAGE = (ROOT / "frontend/src/pages/OrderDetailPage.tsx").read_text(encoding="utf-8")
AFTER_SALES_PAGE = (ROOT / "frontend/src/pages/AfterSalesPage.tsx").read_text(encoding="utf-8")
ORDER_SERVICE = (ROOT / "backend/app/services/order_service.py").read_text(encoding="utf-8")
SYNC_SERVICE_BACKEND = (ROOT / "backend/app/services/sync_service.py").read_text(encoding="utf-8")
SYNC_BACKEND_API = (ROOT / "backend/app/api/v1/sync.py").read_text(encoding="utf-8")
ORDERS_API = (ROOT / "frontend/src/api/orders.ts").read_text(encoding="utf-8")
RISK_CONTROL_SERVICE = (ROOT / "backend/app/services/risk_control_service.py").read_text(encoding="utf-8")
FINANCE_PAGE = (ROOT / "frontend/src/pages/FinancePage.tsx").read_text(encoding="utf-8")
FINANCE_API = (ROOT / "frontend/src/api/finance.ts").read_text(encoding="utf-8")
FINANCE_LEDGER_PANEL = (ROOT / "frontend/src/features/finance/FinanceLedgerPanel.tsx").read_text(encoding="utf-8")
GROWTH_ENGINE_PAGE = (ROOT / "frontend/src/pages/GrowthEnginePage.tsx").read_text(encoding="utf-8")
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
PLATFORMS_API = (ROOT / "frontend/src/api/platforms.ts").read_text(encoding="utf-8")
PLATFORM_SETTINGS_PAGE = (ROOT / "frontend/src/pages/PlatformSettingsPage.tsx").read_text(encoding="utf-8")
PROFESSIONAL_WORKSPACE_FRAME_PATH = ROOT / "frontend/src/components/shared/ProfessionalWorkspaceFrame.tsx"
PROFESSIONAL_WORKSPACE_FRAME = PROFESSIONAL_WORKSPACE_FRAME_PATH.read_text(encoding="utf-8") if PROFESSIONAL_WORKSPACE_FRAME_PATH.exists() else ""
BUSINESS_OBJECT_ACTION_BAR_PATH = ROOT / "frontend/src/components/shared/BusinessObjectActionBar.tsx"
BUSINESS_OBJECT_ACTION_BAR = BUSINESS_OBJECT_ACTION_BAR_PATH.read_text(encoding="utf-8") if BUSINESS_OBJECT_ACTION_BAR_PATH.exists() else ""


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
    if "min-h-[104px]" in BUSINESS_FLOW_V2:
        errors.append("business monitor stage ribbon must not regress to large card-like stage blocks")
    if "aria-label=\"业务处理阶段\"" not in BUSINESS_FLOW_V2:
        errors.append("business monitor stage spine must expose an accessible workflow label")
    business_flow_content = f"{BUSINESS_FLOW_V2}\n{BUSINESS_FLOW_CONTEXT_RAIL}\n{BUSINESS_FLOW_ROUTES}"
    if "item.image_url" not in business_flow_content:
        errors.append("business monitor must show real product images for item-level workflow context")
    if "查看货源" not in business_flow_content:
        errors.append("business monitor context rail must expose the source product link when available")
    for required in ("buildObjectRoute(item.next_action_route, item)", "candidate_id", "product_id", "content_item_id"):
        if required not in business_flow_content:
            errors.append(f"business monitor context rail must carry current object into downstream route: {required}")
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
    if "aria-label=\"风险处置指标\"" not in RISK_CONTROL_WORKSPACE:
        errors.append("risk control metric strip must expose an accessible risk indicator label")
    if "风险雷达" not in RISK_SIGNAL_BOARD:
        errors.append("risk control evidence panel must include a risk radar, not only generic heatmap wording")
    for required in ("风险处置矩阵", "RiskDispositionMatrix", "data.risk_radar"):
        if required not in RISK_SIGNAL_BOARD:
            errors.append(f"risk control must render risk_radar as a disposition matrix: {required}")
    for required in ("处置状态", "SLA状态", "证据数", "RiskDispositionStatusCard"):
        if required not in RISK_CONTROL_WORKSPACE:
            errors.append(f"risk control right panel must expose selected risk disposition state: {required}")
    for required in ("队列密度", "风险排序", "RiskQueueDensityBar"):
        if required not in RISK_CONTROL_WORKSPACE:
            errors.append(f"risk control queue must expose compact density and ordering context: {required}")
    for required in ("证据卡", "RiskEvidenceCard", "原始记录编号"):
        if required not in RISK_EVIDENCE_PANEL:
            errors.append(f"risk control evidence chain must render source refs as evidence cards: {required}")
    for required in ("处理时间线", "TimelineNode", "aria-label=\"风险处理时间线\""):
        if required not in RISK_EVIDENCE_PANEL:
            errors.append(f"risk control audit trail must render as a disposal timeline: {required}")
    if "经营指挥中枢" not in COCKPIT_WORKSPACE:
        errors.append("operating cockpit must present itself as a command center, not a plain summary strip")
    if "运营驾驶舱" in COCKPIT_WORKSPACE:
        errors.append("operating cockpit must not expose the outdated cockpit label")
    if "aria-label=\"经营指挥指标\"" not in COCKPIT_WORKSPACE:
        errors.append("operating cockpit metric strip must expose an accessible command indicator label")
    cockpit_rendered_content = f"{COCKPIT_WORKSPACE}\n{COCKPIT_CENTER_SUMMARY}"
    for required_panel in ("平台店铺矩阵", "风险摘要", "链路摘要"):
        if required_panel not in cockpit_rendered_content:
            errors.append(f"operating cockpit must render {required_panel} from cockpit center summary data")
    for required in ("CockpitStoreMatrixTable", "aria-label=\"平台店铺经营矩阵\"", "查看店铺商品", "查看订单", "查看财务", "同步状态"):
        if required not in COCKPIT_CENTER_SUMMARY:
            errors.append(f"operating cockpit store matrix must expose store-level table and drilldowns: {required}")
    for required in ("资金结构", "利润构成", "CockpitFinancialStructure"):
        if required not in COCKPIT_WORKSPACE:
            errors.append(f"operating cockpit finance panel must expose capital structure detail: {required}")
    for required in ("证据窗口", "行动优先级", "CockpitEvidenceWindow"):
        if required not in COCKPIT_SIDEBAR:
            errors.append(f"operating cockpit right rail must expose evidence windows and action priority: {required}")
    for required in ("经营健康雷达", "经营健康评分", "CockpitHealthRadar"):
        if required not in COCKPIT_WORKSPACE:
            errors.append(f"operating cockpit must expose a compact operation health radar: {required}")
    cockpit_product_ops_content = f"{COCKPIT_WORKSPACE}\n{COCKPIT_TYPES}\n{COCKPIT_COMMAND_WIDGETS}\n{COCKPIT_METRIC_STRIP}"
    for required in ("product_operations", "商品运营表现", "商品运营待复盘", "reviewed_action_count", "pending_action_count"):
        if required not in cockpit_product_ops_content:
            errors.append(f"operating cockpit must expose product operation performance and review drilldown: {required}")
    trend_candidate_content = f"{TREND_DISCOVERY_WORKSPACE}\n{RECOMMENDATION_EVIDENCE_PANEL}\n{RECOMMENDER_READINESS_PANEL}"
    if "候选机会总览" not in trend_candidate_content:
        errors.append("trend candidate page must expose candidate opportunity overview before tabbed tools")
    if "真实证据推荐候选" not in trend_candidate_content:
        errors.append("trend candidate page must surface real-evidence product candidates")
    for required in ("useNavigate", "/product-selection?candidate_id=", "platform=", "market=", "进入选品决策"):
        if required not in RECOMMENDATION_EVIDENCE_PANEL:
            errors.append(f"trend recommendation card must drill into selection decision with candidate context: {required}")
    for required in ("evidenceSummary(item)", "evidenceCompleteness(item)", "safeTextList(item.keywords)", "safeTextList(item.listing_tips)", "证据矩阵待补齐"):
        if required not in RECOMMENDATION_EVIDENCE_PANEL:
            errors.append(f"trend recommendation card must tolerate missing evidence fields without ErrorBoundary crash: {required}")
    if "自动选品决策就绪度" not in trend_candidate_content:
        errors.append("trend candidate page must show selection decision readiness")
    if "PIPELINE_STAGE_OPTIONS" in TREND_PIPELINE_UTILS:
        errors.append("trend pipeline stages must come from runtime config, not local option constants")
    if "window.alert" in TREND_DISCOVERY_FILES or "alert(" in TREND_DISCOVERY_FILES:
        errors.append("trend discovery interactions must use inline state or toast, not browser alerts")
    product_selection_content = f"{PRODUCT_SELECTION_WORKSPACE}\n{PRODUCT_SELECTION_CORE_TABS}\n{DECISION_CANDIDATE_CONTEXT}"
    if "选品决策中枢" not in product_selection_content:
        errors.append("product selection decision page must present itself as a decision command center")
    if "aria-label=\"选品决策商品上下文\"" not in product_selection_content:
        errors.append("product selection decision page must expose concrete product context before scoring")
    if "九维决策评分" not in product_selection_content:
        errors.append("product selection decision page must name the scoring area as nine-dimension decision scoring")
    for required in ("useSearchParams", "candidate_id", "initialCandidateId", "setCandidateId(initialCandidateId)"):
        if required not in PRODUCT_SELECTION_CORE_TABS:
            errors.append(f"product selection decision page must auto-select candidate from route parameter: {required}")
    if "aria-label=\"定价商品上下文\"" not in PRICING_ITEM_SELECTOR:
        errors.append("pricing workbench must show concrete product context before price calculation")
    for required in ("useSearchParams", "content_item_id", "handleSelectItem(initialContentItemId)"):
        if required not in SMART_PRICING_PAGE:
            errors.append(f"pricing page must auto-select content item from route parameter: {required}")
    for required in ("confirmedProductId", "/publish?product_id=${confirmedProductId}", "进入平台刊登"):
        if required not in SMART_PRICING_PAGE:
            errors.append(f"pricing page must continue confirmed product into batch publishing: {required}")
    for required in ("查看货源", "平台字段组核验", "素材要求"):
        if required not in PRICING_ITEM_SELECTOR:
            errors.append(f"pricing item selector must expose {required} for the selected product")
    for required in ("media_readiness", "媒体缺口", "已采集", "平台至少", "缺口："):
        if required not in CONTENT_PRODUCT_QUEUE + PRICING_ITEM_SELECTOR + BATCH_PUBLISH_SELECT + BATCH_PUBLISH_COMPLETENESS:
            errors.append(f"content/pricing/listing workbenches must expose media readiness gaps: {required}")
    if "aria-label=\"素材商品上下文\"" not in CONTENT_MEDIA_STUDIO:
        errors.append("content media studio must expose the selected product context before image/video processing")
    if "使用当前商品源图处理" not in CONTENT_MEDIA_STUDIO:
        errors.append("content media studio must support using the selected product source image")
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
    for required in ("内容任务后台", "任务状态分组", "任务详情诊断", "aria-label=\"内容任务后台表格\""):
        if required not in CONTENT_TASK_MATRIX:
            errors.append(f"content task matrix must become a seller-console task workbench element: {required}")
    for required in ("Listing标题", "商品描述", "PlatformFieldGroupEditor", "onDraftChange"):
        if required not in BATCH_PUBLISH_PREVIEW:
            errors.append(f"batch publish preview must keep editable listing draft field: {required}")
    for required in ("PlatformRealtimePreview", "平台适配实时预览", "Shopee 商品卡", "TEMU 商品卡", "TikTok Shop 商品卡"):
        if required not in BATCH_PUBLISH_PREVIEW:
            errors.append(f"batch publish preview must expose three-platform realtime listing preview: {required}")
    for required in ("草稿结果明细", "平台字段落库诊断", "PlatformFieldGroupSummary"):
        if required not in BATCH_PUBLISH_RESULT:
            errors.append(f"batch publish result step must expose listing draft persistence diagnostics: {required}")
    for required in ("查看商品 Listing", "?tab=listings"):
        if required not in BATCH_PUBLISH_RESULT:
            errors.append(f"batch publish result step must link created drafts back to product listing detail: {required}")
    for required in ("useSearchParams", "product_id", "product_ids", "getProduct", "setSelectedItems"):
        if required not in BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish workspace must keep product detail deep-link support: {required}")
    if "不选则按平台默认店铺生成" in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
        errors.append("batch publish must not generate drafts for an implicit default store")
    for required in ("必须选择目标店铺", "selectedStores.size === 0", "请选择至少一个目标店铺"):
        if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
            errors.append(f"batch publish must require explicit target store selection: {required}")
    for required in ("selectedPlatformsList", "多平台字段组", "platformRequirementsForSelection"):
        if required not in BATCH_PUBLISH_SELECT:
            errors.append(f"batch publish select step must show requirements for every selected platform: {required}")
    if "Array.from(selectedPlatforms)[0]" in BATCH_PUBLISH_SELECT:
        errors.append("batch publish select step must not inspect only the first selected platform for field requirements")
    if "ProductBulkToolbar" not in PRODUCT_EDIT_PAGE and "ProductBulkToolbar" not in PRODUCT_LIST_PAGE:
        errors.append("product list selected toolbar must not regress to empty batch action buttons")
    if "库存待接入" in PRODUCT_BULK_TOOLBAR:
        errors.append("product selected toolbar must not expose stock update as a disabled placeholder")
    for required in ("batchUpdateStock", "stockValue", "onApplyStock", "批量设置店铺库存"):
        if required not in PRODUCT_LIST_PAGE + PRODUCT_BULK_TOOLBAR + PRODUCTS_API:
            errors.append(f"product selected toolbar must support batch store listing stock updates: {required}")
    for required in ("商品后台列表", "状态诊断", "平台字段诊断", "PlatformFieldGroupSummary", "创建 Listing"):
        if required not in PRODUCT_SELLER_WORKBENCH:
            errors.append(f"product seller workbench must keep seller-console operation element: {required}")
    for required in ("商品机会处理", "诊断动作队列", "aria-label=\"商品机会处理\"", "opportunityActions"):
        if required not in PRODUCT_SELLER_WORKBENCH:
            errors.append(f"product seller workbench must expose opportunity handling diagnostics: {required}")
    if "/content?product_id=${product.id}" not in PRODUCT_SELLER_WORKBENCH:
        errors.append("product seller workbench must carry product_id when drilling into content production")
    if "ProductSellerWorkbench" not in PRODUCT_LIST_PAGE:
        errors.append("product list page must use the seller-console workbench instead of a generic product table")
    for required in ("平台店铺商品", "PlatformStoreProductsPanel", "平台商品同步", "店铺归属"):
        if required not in PRODUCT_LIST_PAGE + PLATFORM_STORE_PRODUCTS_PANEL:
            errors.append(f"product module must expose platform store product inventory: {required}")
    for required in ("mediaReadinessLabel", "平台图片要求", "媒体缺口", "商品主档图片"):
        if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API:
            errors.append(f"platform store products must expose listing media readiness and master image context: {required}")
    for required in ("编辑店铺 Listing", "?tab=listings", "listing_id=", "product_master.id"):
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
    for required in ("useSearchParams", "initialTab", "setActiveTab(initialTab)"):
        if required not in PRODUCT_EDIT_PAGE:
            errors.append(f"product detail page must open requested tab from route parameter: {required}")
    for required in ("发布计划", "平台未尝试发布", "listingPublishPlanText"):
        if required not in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing panel must expose local publish plan and platform publish boundary: {required}")
    for required in ("店铺级 Listing 编辑", "当前编辑店铺 Listing", "updateListingOverrides", "保存店铺覆盖", "SKU/变体"):
        if required not in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing panel must support store-level listing instance editing: {required}")
    for required in ("promoteListingToBaseVersion", "promote-base-version", "生成新基础版本", "显式反哺动作"):
        if required not in PRODUCT_DETAIL_TABS + LISTING_API:
            errors.append(f"product listing panel must make base-version promotion explicit: {required}")
    for required in ("SKU 变体结构化编辑", "variantRows", "添加变体", "删除变体"):
        if required not in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing editor must use structured fields instead of raw JSON: {required}")
    for required in ("LISTING_EDIT_SECTIONS", "listingEditSection", "基础信息", "商品详情", "销售资料/SKU", "媒体素材", "物流与发布", "平台属性"):
        if required not in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing editor must use seller-center style section tabs: {required}")
    for required in ("TikTok：最多 9 张图", "Shopee/妙手：图片、视频、物流、货源链接同一商品上下文维护", "当前店铺覆盖"):
        if required not in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing editor must explain platform listing edit constraints: {required}")
    for required in ("店铺视频 URL", "货源链接", "包裹重量", "包裹长宽高", "shipping_config", "video_url", "source_url"):
        if required not in PRODUCT_DETAIL_TABS + LISTING_API:
            errors.append(f"product listing editor must persist media/source/logistics store overrides: {required}")
    for required in ("publish_plan", "定时发布时间", "本地发布计划"):
        if required not in PRODUCT_DETAIL_TABS + LISTING_API:
            errors.append(f"product listing editor must persist local publish plan store overrides: {required}")
    for forbidden in ("promotion_config", "促销活动名称", "店铺促销配置", "buildPromotionConfig", "listingPromotionValue"):
        if forbidden in PRODUCT_DETAIL_TABS + LISTING_API:
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
        if required not in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing editor must render platform field group form: {required}")
    for required in ("ListingFieldEvidencePanel", "平台字段补证队列", "类目待补证字段", "编辑页待补证字段", "接口待补证字段", "补证后再发布", "platformFieldEvidenceGaps"):
        if required not in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing editor must expose category/edit-page/API field recheck gaps: {required}")
    for required in ("类目差异字段组", "category_profile", "matched_category", "补证字段"):
        if required not in PLATFORM_FIELD_GROUPS:
            errors.append(f"platform field groups must show matched category profile and gap count: {required}")
    for forbidden in ("attributeRows", "平台属性结构化编辑", "添加属性", "删除属性", "toAttributeRows", "updateAttributeRow"):
        if forbidden in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing editor must not use generic key/value platform attributes: {forbidden}")
    for required in ("从商品图片选择", "商品主档已入库图片", "toggleListingImage", "使用主档图片", "selectedListingImageSet"):
        if required not in PRODUCT_DETAIL_TABS:
            errors.append(f"product listing editor must reuse ingested product images: {required}")
    for forbidden in ("SKU/变体 JSON", "平台属性 JSON", "parseJsonArray", "parseJsonObject"):
        if forbidden in PRODUCT_DETAIL_TABS:
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
    for required in ("同步复盘", "platform_sync_status", "平台同步复盘", "platform_sync_review", "最近店铺订单同步"):
        if required not in ORDER_LIST_PAGE + ORDER_DETAIL_PAGE:
            errors.append(f"orders pages must expose platform order sync review context: {required}")
    for required in ("platform_account_id", "platformAccountId", "当前订单列表已按经营指挥台下钻的店铺筛选"):
        if required not in ORDER_LIST_PAGE + ORDERS_API:
            errors.append(f"orders page must keep cockpit store drilldown filter context: {required}")
    for required in ("履约异常", "履约异常复盘", "fulfillment_exception", "shipping_overdue", "异常处理动作闭环", "create_shipment", "review_after_sales", "replenish_platform_bill"):
        if required not in ORDER_LIST_PAGE + ORDER_DETAIL_PAGE + ORDER_SERVICE:
            errors.append(f"orders pages must expose fulfillment exception queue context: {required}")
    for required in ("useOrder", "order.after_sales_status", "履约异常原因", "不生成模拟售后记录"):
        if required not in AFTER_SALES_PAGE:
            errors.append(f"after-sales page must show linked order context without fake platform tickets: {required}")
    for required in ("fulfillment_exception", "/orders?exceptions=1", "物流时效风险"):
        if required not in RISK_CONTROL_SERVICE:
            errors.append(f"risk control must reuse order fulfillment exception context: {required}")
    for required in ("initialOrderId", "order_id", "关联订单ID"):
        if required not in FINANCE_LEDGER_PANEL + FINANCE_PAGE:
            errors.append(f"finance ledger panel must accept order_id from query for platform bill replenishment: {required}")
    for required in ("initialPlatformAccountId", "platform_account_id", "当前从经营指挥台按店铺下钻", "最近台账与平台账单同步默认使用该店铺"):
        if required not in FINANCE_LEDGER_PANEL + FINANCE_PAGE + FINANCE_API:
            errors.append(f"finance page must keep cockpit store drilldown filter context: {required}")
    for required in ("平台账单批量导入", "importPlatformBills", "/finance/platform-bills/import", "import_ref 用于去重"):
        if required not in FINANCE_PAGE + FINANCE_API:
            errors.append(f"finance page must expose platform bill batch import workflow: {required}")
    for required in ("Open API 同步", "syncPlatformBills", "/finance/platform-bills/sync", "账单API待接入", "Open API 暂不可用"):
        if required not in FINANCE_PAGE + FINANCE_API:
            errors.append(f"finance page must expose truthful platform bill Open API sync workflow: {required}")
    for required in ("商品运营诊断", "getProductOperationMetrics", "/operations/product-metrics", "conversion_rate_pct", "生成运营台账", "createProductOperationAction", "/operations/product-actions"):
        if required not in GROWTH_ENGINE_PAGE + OPERATIONS_API:
            errors.append(f"growth engine must expose product-level operation metrics and diagnostics: {required}")

    return errors


if __name__ == "__main__":
    failures = validate()
    if failures:
        raise SystemExit("\n".join(failures))
    print("Validated frontend information architecture")

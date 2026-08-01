"""Validation rule chunk for frontend information architecture."""

from .context import *  # noqa: F401,F403

_CHUNK = r'''
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
for required in (
    "data-ui=\"order-v5-sku-field-dictionary\"",
    "orderV5SkuFieldRows",
    "standardFieldLabel",
    "unified_field_dictionary",
    "merchant_sku",
    "platform_sku",
    "spu_skc",
    "sku_image_role",
):
    if required not in ORDER_DETAIL_PAGE:
        errors.append(f"order detail must render V5 SKU context through unified field dictionary: {required}")
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
for required in (
    "fields: \"字段字典\"",
    "FieldDictionarySettings",
    "data-ui=\"settings-unified-field-dictionary\"",
    "unified_field_dictionary",
    "UnifiedFieldDictionaryItem",
    "getFieldDictionaryVersions",
    "saveFieldDictionaryDraft",
    "publishFieldDictionaryDraft",
    "data-ui=\"settings-field-dictionary-version-governance\"",
    "PlatformFieldGroupGovernance",
    "data-ui=\"settings-platform-field-group-approval\"",
    "getPlatformFieldGroupVersions",
    "savePlatformFieldGroupDraft",
    "publishPlatformFieldGroupDraft",
    "保存 Schema 草稿",
    "发布 Schema",
    "Shopee",
    "TEMU",
    "TikTok",
    "妙手参考",
    "保存草稿",
    "发布草稿",
):
    if required not in SETTINGS_WORKSPACE + SETTINGS_DATA_PANELS + PLATFORM_FIELD_GROUP_GOVERNANCE:
        errors.append(f"settings center must expose versioned unified field dictionary governance: {required}")
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
for required in (
    "initialTargetPlatform",
    "initialTargetStore",
    "initialTargetMarket",
    "data-ui=\"pricing-content-context-handoff\"",
    "内容工厂带入",
    "target_platform",
    "target_store",
    "target_market",
    "routeStoreId",
):
    if required not in SMART_PRICING_PAGE:
        errors.append(f"CORE-V5-005 pricing page must consume content factory handoff context: {required}")
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
pricing_template_preview_surface = SMART_PRICING_PAGE + PRICING_TEMPLATE_STORE_PREVIEW
for required in (
    "PricingTemplateStorePreview",
    "data-ui=\"pricing-template-store-override-preview\"",
    "aria-label=\"定价模板店铺售价覆盖预览\"",
    "模板定价与店铺覆盖预览",
    "目标店铺",
    "平台综合费率",
    "本地币种",
    "汇率口径",
    "平衡档人民币售价",
    "平衡档店铺售价",
    "模板与汇率来源",
    "汇率来源",
    "换算边界",
    "写入边界",
    "pricing_template_id",
    "pricing_template_label",
    "fee_template_id",
    "fee_template_label",
    "shipping_cost_rmb",
    "activity_discount_pct",
    "data-ui=\"pricing-activity-price-preview\"",
    "活动价口径",
    "平衡折后实收",
    "min_profit_rmb",
    "estimated_fee_pct",
    "exchange_rate",
    "确认价格时只创建或更新当前商品、当前店铺的本地 Listing 价格草稿",
):
    if required not in pricing_template_preview_surface:
        errors.append(f"CORE-V5-005 pricing template engine must expose store override price preview: {required}")
for required in ("media_readiness", "媒体缺口", "已采集", "平台至少", "缺口："):
    if required not in CONTENT_PRODUCT_QUEUE + PRICING_ITEM_SELECTOR + BATCH_PUBLISH_SELECT + BATCH_PUBLISH_COMPLETENESS:
        errors.append(f"content/pricing/listing workbenches must expose media readiness gaps: {required}")
if "aria-label=\"素材商品上下文\"" not in CONTENT_MEDIA_STUDIO:
    errors.append("content media studio must expose the selected product context before image/video processing")
if "使用当前商品源图处理" not in CONTENT_MEDIA_STUDIO:
    errors.append("content media studio must support using the selected product source image")
content_media_surface = CONTENT_MEDIA_STUDIO + SELLER_IMAGE_EDITOR_WORKBENCH
'''

def run(env: dict[str, object]) -> None:
    exec(_CHUNK, globals(), env)

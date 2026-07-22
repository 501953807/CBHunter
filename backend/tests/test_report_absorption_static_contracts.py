"""Static guards for findings absorbed from 2026-07-16 reports."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_report_directory_validator_uses_chinese_report_outlet():
    source = read("scripts/validate_test_reports.py")

    assert 'docs" / "测试报告"' in source
    assert "rglob" in source
    assert "docs/test-reports" not in source


def test_top_bar_network_status_has_clear_label():
    source = read("frontend/src/components/layout/Header.tsx")

    assert "网络状态：外网可达" in source
    assert "netStatus?.overseas ? '外网可达'" not in source


def test_business_flow_empty_dwell_uses_dash_not_update_missing():
    source = read("backend/app/services/business_flow_projection_service.py")

    assert '"avg_wait_label": "--"' in source
    assert '"更新时间待补"' not in source


def test_scout_source_frequency_label_is_actionable():
    source = read("frontend/src/features/scout-sources/ScoutSourceCards.tsx")

    assert "每次约" in source
    assert '>约{source.total_time}分钟<' not in source


def test_market_unknown_is_rendered_as_dash_in_core_boards():
    cockpit = read("frontend/src/features/cockpit/CockpitStoreCommandBoard.tsx")
    summary = read("frontend/src/features/cockpit/CockpitCenterSummaryPanels.tsx")
    flow = read("frontend/src/features/business-flow/BusinessFlowCommandBoard.tsx")
    risk = read("frontend/src/features/risk-control/RiskStoreCommandBoard.tsx")

    for source in (cockpit, summary, flow, risk):
        assert "formatMarketLabel" in source
    assert "store.market || '市场待补'" not in cockpit
    assert "store.market || '市场待补'" not in summary


def test_business_flow_command_board_exposes_assignment_and_expand_actions():
    source = read("frontend/src/features/business-flow/BusinessFlowCommandBoard.tsx")

    for marker in (
        "未分配对象处理",
        "data-ui=\"flow-unassigned-actions\"",
        "一键分配给我",
        "另有",
        "展开阶段对象",
        "truncateObjectName",
    ):
        assert marker in source


def test_batch_publish_gate_exposes_repair_actions_and_disabled_reason():
    source = read("frontend/src/features/batch-publish/BatchPublishSelectStep.tsx")

    for label in ("补齐图片", "补齐字段", "补齐目标"):
        assert label in source
    assert "previewDisabledReason" in source
    assert "title={previewDisabledReason}" in source
    for marker in (
        "data-ui=\"publish-image-hover-preview\"",
        "group-hover:scale-[2.8]",
        "PlatformFieldGroupDisclosure",
        "字段组默认折叠",
        "<details",
        "<summary",
    ):
        assert marker in source


def test_finance_import_exposes_platform_bill_json_example_and_balance_action():
    source = read("frontend/src/pages/FinancePage.tsx")
    ledger_panel = read("frontend/src/features/finance/FinanceLedgerPanel.tsx")

    for marker in ("平台账单 JSON 示例", "MS-BILL-ORDER-001", "cash_balance", "一键填入示例"):
        assert marker in source
    assert "补录资金余额" in source
    assert "initialEntryType === 'cash_balance'" in source
    for marker in ("data-ui=\"finance-trend-chart\"", "收入趋势", "成本趋势", "利润趋势", "资金趋势"):
        assert marker in source
    for marker in ("data-ui=\"finance-ledger-row-actions\"", "查看详情", "复制编辑", "删除记录"):
        assert marker in ledger_panel


def test_smart_pricing_exposes_history_competitor_and_profit_breakdown_panels():
    source = read("frontend/src/pages/SmartPricingPage.tsx")

    for marker in (
        "定价历史",
        "竞品价格带对比",
        "利润拆分",
        "定价模板 / 费用口径",
        "物流费 (RMB)",
        "活动折扣 (%)",
        "最低利润额 (RMB)",
        "定价附加模板",
        "保存当前为模板",
        "updatePricingAdjustmentTemplates",
        "data-ui=\"pricing-profit-breakdown\"",
        "data-ui=\"pricing-fee-template-panel\"",
        "data-ui=\"pricing-adjustment-template-inputs\"",
    ):
        assert marker in source
    assert "source_price_rmb" in source
    assert "estimated_fee_pct" in source
    assert "data-ui=\"pricing-profit-slider\"" in source
    assert "aria-label=\"目标利润率滑块\"" in source


def test_manual_order_form_covers_fulfillment_payment_address_and_import_entry():
    modal = read("frontend/src/features/orders/ManualOrderModal.tsx")
    page = read("frontend/src/pages/OrderListPage.tsx")
    api = read("frontend/src/api/orders.ts")
    route = read("backend/app/api/v1/orders.py")
    service = read("backend/app/services/order_service.py")
    types = read("frontend/src/types/order.ts")
    schema = read("backend/app/schemas/order.py")

    for marker in ("shipping_address", "shipping_fee", "platform_fee", "discount", "payment_method", "fulfillment_deadline_at", "logistics_channel"):
        assert marker in modal
        assert marker in types
        assert marker in schema
    assert "CSV/Excel批量导入" in page
    assert "订单导入模板字段" in page
    assert "parseManualOrderCsv" in page
    assert "importManualOrders" in api
    assert '@router.post("/import"' in route
    assert "import_manual_orders" in service
    assert "ManualOrderImportRequest" in schema


def test_order_list_exposes_sync_fulfillment_and_shipping_sla_filters():
    page = read("frontend/src/pages/OrderListPage.tsx")
    api = read("frontend/src/api/orders.ts")
    route = read("backend/app/api/v1/orders.py")
    service = read("backend/app/services/order_service.py")

    for marker in (
        "data-ui=\"order-fulfillment-filter-bar\"",
        "全部履约状态",
        "全部同步状态",
        "全部发货时效",
        "shippingSlaLabel",
        "距发货截止",
    ):
        assert marker in page
    for marker in ("fulfillment_exception_status", "sync_status", "shipping_sla"):
        assert marker in api
        assert marker in route
        assert marker in service
    assert "_matches_shipping_sla" in service


def test_settings_home_exposes_config_health_summary():
    source = read("frontend/src/features/settings/SettingsWorkspace.tsx")

    for marker in ("配置健康度", "getConfigQuality", "SettingsQualitySummary", "进入配置巡检"):
        assert marker in source


def test_risk_control_exposes_sla_templates_and_config_entry():
    service = read("backend/app/services/risk_control_service.py")
    sla_service = read("backend/app/services/risk_control_sla_service.py")
    source_summary_service = read("backend/app/services/risk_control_source_summary_service.py")
    workspace = read("frontend/src/features/risk-control/RiskControlWorkspace.tsx")
    types = read("frontend/src/types/riskControl.ts")
    catalog = read("backend/app/data/default_system_configs.json")

    assert "RISK_SLA_TEMPLATES" in service
    assert 'get_config_json(db, "risk.sla_templates")' in sla_service
    for marker in ("risk_sla_templates", "sla_template_key"):
        assert marker in service
        assert marker in types
    assert '"key":"risk.sla_templates"' in catalog
    for marker in ("风险 SLA 模板", "进入 SLA 配置", "/settings/keys"):
        assert marker in workspace
    assert "_risk_location_gap_queue" in service
    assert "location_gap_queue" in service
    assert "location_gap_queue" in types
    for marker in ("待定位信息合并队列", "LocationGapQueuePanel", "补齐平台归属", "补齐店铺归属", "补齐目标市场"):
        assert marker in workspace
    for marker in ("risk_source_summary", "build_risk_source_summary", "履约超时", "库存断货", "利润异常"):
        assert marker in service or marker in source_summary_service or marker in types or marker in workspace
    for marker in ("data-ui=\"risk-stage2-signal-summary\"", "RiskSourceSummaryPanel", "fulfillment_overdue", "inventory_stockout", "profit_anomaly"):
        assert marker in workspace or marker in types


def test_scout_selection_exposes_signal_repair_pagination_and_candidate_detail():
    funnel = read("frontend/src/features/scout-sources/SignalFunnelOverview.tsx")
    source_cards = read("frontend/src/features/scout-sources/ScoutSourceCards.tsx")
    recommendation = read("frontend/src/features/trend-discovery/RecommendationEvidencePanel.tsx")

    for marker in ("CompleteCandidateRepairPanel", "完整候选补齐路径", "补社交文娱影响", "补流行趋势", "补销售平台", "补供应渠道"):
        assert marker in funnel
    for marker in ("visibleStreamCount", "加载更多信号", "aria-label=\"最新信号流分页\""):
        assert marker in funnel
    assert "录入信号" in source_cards
    for marker in ("CandidateAnalysisGrid", "评分维度", "资料来源", "趋势数据", "对比决策", "data-ui=\"candidate-detail-analysis\""):
        assert marker in recommendation


def test_content_factory_exposes_unified_listing_creation_workbench():
    workspace = read("frontend/src/features/content-planner/ContentPlannerWorkspace.tsx")
    editor = read("frontend/src/features/content-planner/ListingUnifiedEditorSections.tsx")
    title_editor = read("frontend/src/features/content-planner/ContentTitleGenerator.tsx")

    assert "Listing 一体化内容工作台" in workspace
    for marker in ("ContentListingCapabilityMap", "data-ui=\"content-listing-capability-map\"", "标题生成", "描述编辑", "图片处理", "视频脚本", "A+内容", "平台差异字段校验", "AI辅助生成入口"):
        assert marker in editor
    for marker in ("标题、五点卖点与长描述编辑台", "AI生成标题候选", "确认描述"):
        assert marker in title_editor


def test_operations_growth_competitor_expose_detailed_views():
    operations = read("frontend/src/features/operations/OperationsWorkspace.tsx")
    growth = read("frontend/src/pages/GrowthEnginePage.tsx")
    competitor = read("frontend/src/pages/CompetitorMonitorPage.tsx")

    for marker in ("OperationCadencePanel", "日常运营记录", "每周运营记录", "每月运营记录", "data-ui=\"operation-trend-chart\""):
        assert marker in operations
    for marker in ("GrowthExperimentPanel", "机会发现", "实验管理", "反馈学习", "A/B测试", "data-ui=\"growth-ab-test-panel\""):
        assert marker in growth
    for marker in ("CompetitorInsightPanel", "竞品列表", "价格追踪", "快照对比", "预警设置", "data-ui=\"competitor-price-trend\""):
        assert marker in competitor


def test_reports_inventory_ai_expose_detailed_views():
    reports = read("frontend/src/features/reports/ReportsWorkspace.tsx")
    inventory = read("frontend/src/features/inventory-alerts/InventoryAlertWorkspace.tsx")
    ai = read("frontend/src/pages/AISuggestionsPage.tsx")

    for marker in ("ReportOperationsPanel", "日报生成", "周报生成", "月报生成", "订阅管理", "data-ui=\"report-business-chart\""):
        assert marker in reports
    for marker in ("InventoryDetailViewPanel", "预警规则配置", "库存列表", "补货建议", "周转天数", "库龄分析", "data-ui=\"inventory-aging-turnover\""):
        assert marker in inventory
    for marker in ("AIEngineDetailPanel", "AI任务列表", "Provider管理", "反馈收集", "可信度评分", "来源追溯", "data-ui=\"ai-engine-traceability\""):
        assert marker in ai


def test_cockpit_and_settings_expose_p2_entry_enhancements():
    cockpit = read("frontend/src/features/cockpit/CockpitStoreCommandBoard.tsx")
    setup = read("frontend/src/features/cockpit/CockpitSetupBanner.tsx")
    settings = read("frontend/src/features/settings/SettingsWorkspace.tsx")
    accounts = read("frontend/src/features/settings/SettingsAccountPanels.tsx")
    audit = read("frontend/src/pages/settings/AuditLogTab.tsx")

    for marker in ("NegativeProfitAlert", "负毛利警示", "data-ui=\"cockpit-negative-profit-alert\"", "复核成本利润"):
        assert marker in cockpit
    for marker in ("配置费率与汇率", "/settings/fees"):
        assert marker in setup
        assert marker in settings
    for marker in ("账号搜索", "filteredUsers", "data-ui=\"settings-user-search\""):
        assert marker in accounts
    for marker in ("审计日志时间范围", "最近7天", "最近30天", "applyDateRange", "data-ui=\"audit-date-range-filter\""):
        assert marker in audit


def test_audit_order_status_update_uses_state_machine_and_manual_override():
    schema = read("backend/app/schemas/order.py")
    service = read("backend/app/services/order_service.py")
    route = read("backend/app/api/v1/orders.py")

    for marker in ("manual_override", "reason: Optional[str]"):
        assert marker in schema
    for marker in (
        "_validate_order_status_transition",
        "get_all_dicts",
        "allowed_next",
        "invalid_order_status_transition",
        "manual_override_reason_required",
        "status_history",
    ):
        assert marker in service
    assert "order.status = req.status\n    await db.commit()" not in service
    for marker in ("人工更正订单状态", "按状态机更新订单状态", "manual_override_reason_required"):
        assert marker in route

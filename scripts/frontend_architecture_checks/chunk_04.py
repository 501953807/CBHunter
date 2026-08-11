"""Validation rule chunk for frontend information architecture."""

from .context import *  # noqa: F401,F403

_CHUNK = r'''
for required in (
    "aiSuggestionsQuery",
    "aiSuggestionsQuery.isError",
    "data-ui=\"ai-suggestions-error\"",
    "重新加载 AI 建议",
):
    if required not in AI_SUGGESTIONS_PAGE:
        errors.append(f"AUDIT-P2-03 AI suggestions page must expose visible React Query error recovery: {required}")
for required in ("./ai-suggestions.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"AI suggestions V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "ai-suggestions-shell",
    "ai-suggestions-hero",
    "ai-suggestions-filter-bar",
    "ai-suggestions-engine-panel",
    "ai-suggestions-metric-grid",
    "ai-suggestions-metric-card",
    "ai-suggestions-trace-grid",
    "ai-suggestions-task-panel",
    "ai-suggestions-task-row",
    "ai-suggestion-card",
    "ai-suggestion-evidence-panel",
    "ai-suggestion-actions",
    "ai-suggestions-error-panel",
    "ai-suggestions-empty-panel",
):
    if required not in AI_SUGGESTIONS_CSS:
        errors.append(f"AI suggestions stylesheet must keep V5 AI engine visual primitive: {required}")
for required in (
    "ai-suggestions-shell",
    "ai-suggestions-hero",
    "ai-suggestions-filter-bar",
    "ai-suggestions-engine-panel",
    "ai-suggestions-metric-grid",
    "ai-suggestions-trace-grid",
    "ai-suggestions-task-panel",
    "ai-suggestions-task-row",
    "ai-suggestion-card",
    "ai-suggestion-evidence-panel",
    "ai-suggestion-actions",
    "AIEngineDetailPanel",
    "useSuggestions",
    "useRunAnalysis",
    "useMarkRead",
    "useMarkApplied",
    "useDismissSuggestion",
    "useConfig",
    "data-ui=\"ai-suggestions-error\"",
    "data-ui=\"ai-engine-traceability\"",
    "重新加载 AI 建议",
):
    if required not in AI_SUGGESTIONS_PAGE:
        errors.append(f"AI suggestions page must consume V5 visual primitives and keep business controls: {required}")
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
    "unified_field_dictionary",
    "data-ui=\"inventory-v5-sku-field-dictionary\"",
    "inventoryV5SkuFieldRows",
    "normalizeInventoryPlatformKey",
    "product_title",
    "sku_id",
    "sku_stock",
    "sku_price",
):
    if required not in INVENTORY_ALERT_PANELS:
        errors.append(f"inventory risk workbench must render V5 SKU fields through unified field dictionary: {required}")
for required in ("./inventory-alerts.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"inventory alerts V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "inventory-alert-shell",
    "inventory-alert-hero",
    "inventory-alert-metric-grid",
    "inventory-alert-metric-card",
    "inventory-risk-workbench",
    "inventory-risk-lane-card",
    "inventory-alert-detail-panel",
    "inventory-alert-tabs",
    "inventory-alert-table-shell",
    "inventory-alert-row",
    "inventory-alert-filter-bar",
    "inventory-alert-action",
):
    if required not in INVENTORY_ALERTS_CSS:
        errors.append(f"inventory alerts stylesheet must keep V5 inventory visual primitive: {required}")
for required in (
    "inventory-alert-shell",
    "inventory-alert-hero",
    "inventory-alert-metric-grid",
    "inventory-alert-metric-card",
    "inventory-alert-detail-panel",
    "inventory-alert-tabs",
    "InventoryRiskWorkbench",
    "InventoryDetailViewPanel",
    "CheckInventoryButton",
    "RulesTab",
    "HistoryTab",
    "AddRuleModal",
):
    if required not in INVENTORY_ALERT_WORKSPACE:
        errors.append(f"inventory alert workspace must consume V5 visual primitives and keep business panels: {required}")
for required in (
    "inventory-risk-workbench",
    "inventory-risk-grid",
    "inventory-alert-table-shell",
    "inventory-alert-row",
    "inventory-rule-table-panel",
    "inventory-history-table-panel",
    "inventory-alert-filter-bar",
    "inventory-alert-action",
    "useConfirm",
    "useTriggerProductSync",
    "useCheckInventory",
    "useUpdateAlertRule",
    "useDeleteAlertRule",
    "useAcknowledgeAlert",
    "useClearAlert",
):
    if required not in INVENTORY_ALERT_PANELS:
        errors.append(f"inventory alert panels must consume V5 visual primitives and keep business controls: {required}")
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
for required in ("./settings.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"settings V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "settings-shell",
    "settings-hero",
    "settings-layout",
    "settings-nav-panel",
    "settings-content-panel",
    "settings-quality-panel",
    "settings-framework-note",
    "settings-nav-item",
    "settings-quality-score",
):
    if required not in SETTINGS_CSS:
        errors.append(f"settings stylesheet must keep V5 settings visual primitive: {required}")
for required in (
    "settings-shell",
    "settings-hero",
    "settings-layout",
    "settings-nav-panel",
    "settings-content-panel",
    "settings-quality-panel",
    "settings-framework-note",
    "settings-nav-item",
    "data-active={effectiveTab === id ? 'true' : 'false'}",
    "SettingsQualitySummary",
    "visibleTabIds.has(activeTab)",
):
    if required not in SETTINGS_WORKSPACE:
        errors.append(f"settings workspace must consume V5 settings visual primitive and keep governance controls: {required}")
for required in ("./growth.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"growth engine V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "growth-shell",
    "growth-hero",
    "growth-panel",
    "growth-summary-panel",
    "growth-opportunity-card",
    "growth-diagnostic-card",
    "growth-experiment-card",
    "growth-feedback-card",
    "growth-action-card",
    "growth-error-panel",
    "growth-score-strip",
):
    if required not in GROWTH_CSS:
        errors.append(f"growth engine stylesheet must keep V5 growth visual primitive: {required}")
for required in (
    "growth-shell",
    "growth-hero",
    "growth-summary-panel",
    "growth-opportunity-card",
    "growth-diagnostic-card",
    "growth-experiment-card",
    "growth-feedback-card",
    "growth-action-card",
    "growth-error-panel",
    "data-ui=\"growth-opportunity-error\"",
    "data-ui=\"growth-metrics-error\"",
    "data-ui=\"growth-ab-test-panel\"",
    "createOperationAction",
    "重新加载增长机会",
    "重新加载运营指标",
):
    if required not in GROWTH_ENGINE_PAGE:
        errors.append(f"growth engine page must consume V5 growth visual primitive and keep business controls: {required}")
for required in ("./competitor.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"competitor monitor V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "competitor-shell",
    "competitor-hero",
    "competitor-metric-grid",
    "competitor-metric-card",
    "competitor-gap-panel",
    "competitor-panel",
    "competitor-table-panel",
    "competitor-table-shell",
    "competitor-insight-card",
    "competitor-trend-panel",
    "competitor-action-button",
):
    if required not in COMPETITOR_CSS:
        errors.append(f"competitor monitor stylesheet must keep V5 competitor visual primitive: {required}")
for required in (
    "competitor-shell",
    "competitor-hero",
    "competitor-metric-grid",
    "competitor-gap-panel",
    "competitor-panel",
    "competitor-table-panel",
    "competitor-table-shell",
    "competitor-insight-card",
    "competitor-trend-panel",
    "competitor-action-button",
    "data-ui=\"competitor-dashboard-error\"",
    "data-ui=\"competitor-price-trend\"",
    "useMonitorDashboard",
    "useRemoveCompetitor",
    "useConfirm",
    "AddCompetitorModal",
    "AlertRuleModal",
):
    if required not in COMPETITOR_MONITOR_PAGE:
        errors.append(f"competitor monitor page must consume V5 visual primitives and keep business controls: {required}")
for required in ("./operations.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"operations ledger V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "operations-shell",
    "operations-hero",
    "operations-metric-grid",
    "operations-summary-card",
    "operations-cadence-panel",
    "operations-form-panel",
    "operations-table-panel",
    "operations-table-shell",
    "operations-cadence-tile",
    "operations-action-button",
):
    if required not in OPERATIONS_CSS:
        errors.append(f"operations ledger stylesheet must keep V5 operations visual primitive: {required}")
for required in (
    "operations-shell",
    "operations-hero",
    "operations-metric-grid",
    "operations-summary-card",
    "operations-cadence-panel",
    "operations-form-panel",
    "operations-table-panel",
    "operations-table-shell",
    "operations-cadence-tile",
    "operations-action-button",
    "data-ui=\"operation-trend-chart\"",
    "useConfirm",
    "listOperationRecords(requestedType || undefined)",
    "getOperationOptions",
    "createOperationRecord",
    "updateOperationRecord",
    "deleteOperationRecord",
    "allowsZeroBudgetOperationRecord",
):
    if required not in OPERATIONS_WORKSPACE:
        errors.append(f"operations workspace must consume V5 visual primitives and keep business controls: {required}")
for required in ("./promotions.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"promotions V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "promotions-shell",
    "promotions-hero",
    "promotions-governance-grid",
    "promotions-form-panel",
    "promotions-action-panel",
    "promotions-table-panel",
    "promotions-table-shell",
    "promotions-candidate-card",
    "promotions-row-action",
    "promotions-field-input",
):
    if required not in PROMOTIONS_CSS:
        errors.append(f"promotions stylesheet must keep V5 promotions visual primitive: {required}")
for required in (
    "promotions-shell",
    "promotions-hero",
    "promotions-form-panel",
    "promotions-action-panel",
    "promotions-table-panel",
    "promotions-table-shell",
    "promotions-candidate-card",
    "promotions-row-action",
    "professional-table",
    "createPromotionCampaign",
    "updatePromotionCampaign",
    "addPromotionCampaignItems",
    "updatePromotionCampaignDiscount",
    "updatePromotionCampaignStatus",
    "syncPromotionCampaign",
    "useConfirm",
    "PromotionWatermarkSelector",
    "PromotionTypeRuleGuide",
):
    if required not in PROMOTIONS_PAGE:
        errors.append(f"promotions page must consume V5 visual primitives and keep business controls: {required}")
for required in (
    "promotions-governance-grid",
    "promotions-governance-card",
    "data-ui=\"promotion-governance-summary\"",
    "buildPromotionGovernanceSummary",
):
    if required not in PROMOTION_GOVERNANCE_PANEL:
        errors.append(f"promotion governance panel must consume V5 summary primitives and keep governance summary: {required}")
'''

def run(env: dict[str, object]) -> None:
    exec(_CHUNK, globals(), env)

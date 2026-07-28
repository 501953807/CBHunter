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
'''

def run(env: dict[str, object]) -> None:
    exec(_CHUNK, globals(), env)

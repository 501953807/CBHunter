"""Validation rule chunk for page-level V5 visual primitives."""

from .context import *  # noqa: F401,F403

_CHUNK = r'''
for required in ("./listing-templates.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"listing templates V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "listing-templates-shell",
    "listing-templates-hero",
    "listing-templates-governance-grid",
    "listing-templates-metric-card",
    "listing-templates-workbench-card",
    "listing-templates-filter-toolbar",
    "listing-templates-table-shell",
    "listing-templates-row-action",
    "listing-templates-preview-panel",
    "listing-templates-preview-canvas",
):
    if required not in LISTING_TEMPLATES_CSS:
        errors.append(f"listing templates stylesheet must keep V5 watermark template visual primitive: {required}")
for required in (
    "listing-templates-shell",
    "listing-templates-hero",
    "listing-templates-governance-grid",
    "listing-templates-metric-card",
    "listing-templates-workbench-card",
    "listing-templates-filter-toolbar",
    "listing-templates-table-shell",
    "listing-templates-row-action",
    "listing-templates-preview-panel",
    "listing-templates-preview-canvas",
    "listListingTemplates",
    "createListingTemplate",
    "updateListingTemplate",
    "deleteListingTemplate",
    "useConfirm",
    "EvidenceBanner",
    "WatermarkGovernancePanel",
):
    if required not in LISTING_TEMPLATES_WORKSPACE:
        errors.append(f"listing templates workspace must consume V5 visual primitives and keep watermark template controls: {required}")

for required in ("./platform-settings.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"platform settings V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "platform-settings-shell",
    "platform-settings-hero",
    "platform-settings-governance-panel",
    "platform-settings-governance-grid",
    "platform-settings-metric-card",
    "platform-settings-boundary-grid",
    "platform-settings-platform-grid",
    "platform-settings-platform-card",
    "platform-settings-store-card",
    "platform-settings-token-panel",
    "platform-settings-log-panel",
    "platform-settings-modal-note",
):
    if required not in PLATFORM_SETTINGS_CSS:
        errors.append(f"platform settings stylesheet must keep V5 platform access visual primitive: {required}")
for required in (
    "platform-settings-shell",
    "platform-settings-hero",
    "platform-settings-governance-panel",
    "platform-settings-platform-card",
    "platform-settings-store-card",
    "platform-settings-token-panel",
    "platform-settings-log-panel",
    "usePlatforms",
    "usePlatformStatuses",
    "useCreatePlatform",
    "useDeletePlatform",
    "useUpdatePlatformAuthorization",
    "useTriggerSync",
    "getSyncLogs",
    "EvidenceBanner",
    "platform-authorization-governance-summary",
    "handleConnect",
    "handleAuthorizationSave",
):
    if required not in PLATFORM_SETTINGS_PAGE:
        errors.append(f"platform settings page must consume V5 visual primitives and keep platform access controls: {required}")

for required in ("./listing-spec-editor.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"listing spec editor V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "listing-spec-workbench",
    "data-ui=\"listing-spec-editor-seller-console\"",
    "data-ui=\"listing-sku-editable-variant-table\"",
    "data-ui=\"sku-variation-combination-generator\"",
    "data-ui=\"sku-platform-readiness-checklist\"",
    "data-ui=\"sku-platform-field-mapping-table\"",
    "data-ui=\"sku-image-asset-picker\"",
):
    if required not in LISTING_SPECIFICATION_EDITOR + LISTING_SPEC_EDITOR_CSS:
        errors.append(f"listing spec editor must keep V5 SKU/platform field workbench primitives: {required}")
for required in (
    "SKU/变体、平台属性、物流包装、合规检查",
    "批量启用SKU",
    "批量停用SKU",
    "新增规格行",
    "按规格组合追加SKU",
    "按规格组合重建SKU",
    "保存规格到店铺覆盖草稿",
    "复制规格字段包",
):
    if required not in LISTING_SPECIFICATION_EDITOR:
        errors.append(f"listing spec editor must keep seller-console SKU and platform field controls: {required}")

for required in ("./listing-editor.css",):
    if required not in STYLE_MODULES_CSS:
        errors.append(f"listing unified editor V5 stylesheet must be imported in styles/modules.css: {required}")
for required in (
    "listing-editor-shell",
    "listing-editor-header",
    "listing-editor-nav",
    "listing-editor-section",
    "listing-auxiliary-panel",
    "listing-editor-summary-card",
    "data-ui=\"listing-editor-wide-continuous-layout\"",
    "data-ui=\"listing-v5-field-nav\"",
    "data-ui=\"listing-copy-editor-seller-console\"",
    "data-ui=\"content-media-studio\"",
):
    if required not in LISTING_UNIFIED_EDITOR_SECTIONS + CONTENT_TITLE_GENERATOR + CONTENT_MEDIA_STUDIO + LISTING_EDITOR_CSS:
        errors.append(f"listing unified editor must keep V5 continuous editing visual primitives: {required}")
'''

def run(env: dict[str, object]) -> None:
    exec(_CHUNK, globals(), env)

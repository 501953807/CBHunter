"""Validation rules for Materio reference navigation and overlay behavior."""

from .context import *  # noqa: F401,F403

_CHUNK = r'''
for required in (
    "children?: NavItem[]",
    "export interface NavGroup",
    "export const navGroups",
    "label: '应用全局'",
    "label: '选品'",
    "label: '订单'",
    "label: '运营'",
    "label: '系统'",
    "label: '经营指挥台'",
    "label: '风险管控台'",
    "label: '业务监控台'",
    "label: '品源与选品'",
    "label: '内容与刊登'",
    "label: '商品与库存'",
    "label: '订单履约'",
    "label: '运营增长'",
    "{ to: '/publish/templates', label: '图片/水印模板' }",
    "{ to: '/orders/after-sales', label: '售后处理' }",
    "{ to: '/platforms', label: '平台账号' }",
    "export const navItems: NavItem[] = navGroups.flatMap",
):
    if required not in NAVIGATION:
        errors.append(f"global navigation must keep Materio-style grouped first/second level menu data: {required}")

for required in (
    "activeChildTo",
    "navGroups.map",
    "materio-nav-section",
    "nav-section-title",
    "materio-subnav-stack",
    "materio-subnav-item",
    "onChildNavigate",
    "ChevronRight",
    "CircleDot",
    "nav-pin",
    "nav-unpin",
    "nav-group-arrow",
    "nav-item-badge",
    "is-collapsed",
):
    if required not in SIDEBAR:
        errors.append(f"Sidebar must keep expandable/collapsed secondary menu behavior: {required}")

for required in (
    "Settings2",
    "materio-floating-customizer",
    "aria-label=\"打开主题自定义\"",
    "createPortal",
    "materio-customizer-drawer",
    "Theme Customizer",
    "Primary Color",
    "Semi Dark Menu",
    "Direction",
    "setThemeOpen(open => !open)",
):
    if required not in HEADER:
        errors.append(f"Header must keep right-side Materio customizer entry: {required}")

for required in (
    "overflow-visible",
    "min-h-[100dvh]",
):
    if required not in APP_LAYOUT:
        errors.append(f"AppLayout must not clip header overlay and must use stable viewport sizing: {required}")

for required in (
    "--materio-overlay-z",
    "--materio-floating-z",
    "--materio-sidebar-collapsed: 68px",
    ".layout-vertical-nav",
    ".nav-group-arrow",
    ".nav-item-badge",
    ".materio-navbar-action",
    ".materio-action-badge",
    ".materio-nav-section",
    ".nav-section-title",
    ".materio-subnav-item",
    ".layout-vertical-nav.is-collapsed:hover",
    "block-size: 0 !important",
    "max-block-size: 0 !important",
    ".materio-floating-customizer",
    ".materio-customizer-drawer",
    ".materio-customizer-header",
    ".materio-customizer-body",
    ".materio-color-swatch",
    ".materio-preview-option",
    ".materio-layout-preview",
    ".materio-switch-row",
    "[data-ui=\"theme-preset-select\"]",
    "z-index: calc(var(--materio-overlay-z)",
    ".luxury-page-frame :is(input[type=\"checkbox\"], input[type=\"radio\"])",
    ".luxury-page-frame :is(input, select, textarea):not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"color\"])",
    ".luxury-page-frame :is(table)",
):
    if required not in MATERIO_SYSTEM_CSS:
        errors.append(f"Materio system CSS must keep grouped nav, shared form/table and overlay primitives: {required}")

for required in (
    "DesignSystemPage",
    "path=\"design-system\"",
    "import.meta.env.DEV",
):
    if required not in APP:
        errors.append(f"App must expose the hidden design-system validation route: {required}")

for required in (
    "data-ui=\"materio-design-system-page\"",
    "Materio UI Kit 验收页",
    "Design Tokens",
    "Buttons",
    "Form Controls",
    "Tabs / Chips / Badges",
    "Data Table / Toolbar / Pagination",
    "Dialog / Drawer",
    "Empty / Loading / Alert",
    "DataTable",
    "Modal",
    "EmptyState",
    "Checkbox",
    "RadioGroup",
    "Switch",
    "useConfirm",
    "useToast",
    "materio-customizer-drawer",
    "materio-alert",
    "materio-progress",
    "materio-toolbar",
    "materio-search-field",
):
    if required not in DESIGN_SYSTEM_PAGE:
        errors.append(f"DesignSystemPage must remain a complete UI primitive acceptance page: {required}")

for required in (
    ".materio-design-system-page",
    ".materio-kit-grid",
    ".materio-token-card",
    ".materio-form-demo-grid",
    ".materio-field-shell",
    ".materio-search-field",
    ".materio-toolbar",
    ".materio-avatar-cell",
    ".materio-progress",
    ".materio-alert",
    ".materio-check-control",
    ".materio-radio-group",
    ".materio-switch-control",
):
    if required not in MATERIO_SYSTEM_CSS:
        errors.append(f"Materio system CSS must keep design-system acceptance styles: {required}")

for component_name, component_content, required_class in (
    ("Checkbox", CHECKBOX_COMPONENT, "materio-check-control"),
    ("Checkbox", CHECKBOX_COMPONENT, "materio-check-input"),
    ("RadioGroup", RADIO_GROUP_COMPONENT, "materio-radio-group"),
    ("RadioGroup", RADIO_GROUP_COMPONENT, "materio-radio-input"),
    ("Switch", SWITCH_COMPONENT, "materio-switch-control"),
    ("Switch", SWITCH_COMPONENT, "materio-switch-input"),
):
    if required_class not in component_content:
        errors.append(f"{component_name} must expose Materio form selection primitive: {required_class}")

for required in (
    "import { Checkbox }",
    "function QueueCheckbox",
    "indeterminate?: boolean",
    "content-product-bulk-action-toolbar",
    "content-product-seller-console-table",
):
    if required not in CONTENT_PRODUCT_QUEUE:
        errors.append(f"ContentProductQueue must migrate seller-list selection controls to Materio primitives: {required}")

for forbidden in (
    "type=\"checkbox\"\n                        checked={allVisibleChecked}",
    "type=\"checkbox\"\n                        checked={checkedIds.includes",
):
    if forbidden in CONTENT_PRODUCT_QUEUE:
        errors.append(f"ContentProductQueue must not render raw seller-list checkbox inputs after Materio migration: {forbidden}")

for required in (
    "content-planner-page",
    "content-factory-product-queue-page",
    "content-factory-heading",
    "content-factory-context-controls",
    "ContentListingStageRail",
    "workspaceMode === 'listing'",
    "workspaceMode === 'image'",
):
    if required not in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"ContentPlannerWorkspace must keep list-first workspace with overlay detail/image editors: {required}")

for forbidden in (
    "content-queue-real-action-guide",
    "'1', '勾选商品'",
    "ProfessionalWorkspaceFrame",
):
    if forbidden in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"ContentPlannerWorkspace must not restore oversized instruction cards or extra header chrome: {forbidden}")
'''


def run(env: dict[str, object]) -> None:
    exec(_CHUNK, globals(), env)

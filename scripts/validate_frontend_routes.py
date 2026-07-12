#!/usr/bin/env python3
"""Static route contract validation for the production React shell."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "frontend/src/App.tsx").read_text(encoding="utf-8")
META = (ROOT / "frontend/src/components/layout/routeMeta.ts").read_text(encoding="utf-8")
LAYOUT = (ROOT / "frontend/src/components/layout/AppLayout.tsx").read_text(encoding="utf-8")
NAVIGATION = (ROOT / "frontend/src/components/layout/navigation.ts").read_text(encoding="utf-8")
SIDEBAR = (ROOT / "frontend/src/components/layout/Sidebar.tsx").read_text(encoding="utf-8")
MODULE_SUBNAV_PATH = ROOT / "frontend/src/components/layout/ModuleSubnav.tsx"
MODULE_SUBNAV = MODULE_SUBNAV_PATH.read_text(encoding="utf-8") if MODULE_SUBNAV_PATH.exists() else ""
OPS_DASHBOARD_PATH = ROOT / "frontend/src/pages/OpsDashboardPage.tsx"
STALE_LEGACY_PAGE_PATHS = [
    OPS_DASHBOARD_PATH,
    ROOT / "frontend/src/pages/CockpitPage.tsx",
    ROOT / "frontend/src/pages/DashboardPage.tsx",
]

REQUIRED = {
    "reports", "ai-suggestions", "content/:tab", "shipments", "smart/radar",
    "smart/cross", "profit", "products", "publish", "monitor", "settings/:tab",
    "orders/warehouses", "inventory-alerts", "operations", "growth",
}

LEGACY_ROUTES = {"ops", "cockpit", "dashboard", "selection", "trends"}
DYNAMIC_ROUTES = {"orders/:id", "products/:id", "shipments/:id", "settings/:tab", "content/:tab"}
AUTH_ROUTES = {"/login"}
MIN_PRODUCTION_ROUTE_COUNT = 36


def validate() -> list[str]:
    errors: list[str] = []
    routes = set(re.findall(r'<Route\s+path="([^"]+)"', APP))
    production_routes = {route for route in routes if route not in AUTH_ROUTES}
    if len(production_routes) < MIN_PRODUCTION_ROUTE_COUNT:
        errors.append(f"production route contract too small: {len(production_routes)} < {MIN_PRODUCTION_ROUTE_COUNT}")
    missing = sorted(REQUIRED - routes)
    if missing:
        errors.append(f"missing routes: {', '.join(missing)}")
    missing_legacy = sorted(route for route in LEGACY_ROUTES if route not in routes)
    if missing_legacy:
        errors.append(f"missing legacy compatibility routes: {', '.join(missing_legacy)}")
    required_legacy_redirects = {
        "ops": "/command-center",
        "cockpit": "/command-center",
        "dashboard": "/command-center",
        "selection": "/profit",
        "trends": "/scout",
    }
    for legacy_route, target_route in required_legacy_redirects.items():
        expected = f'path="{legacy_route}" element={{<Navigate to="{target_route}" replace />}}'
        if expected not in APP:
            errors.append(f"legacy /{legacy_route} route must redirect to {target_route} instead of rendering stale page content")
    for stale_path in STALE_LEGACY_PAGE_PATHS:
        if stale_path.exists():
            errors.append(f"stale legacy page must not remain after compatibility route redirects: {stale_path.name}")
    meta_routes = set(re.findall(r"'(/[^']+)':\s*'[^']+'", META))
    dynamic_missing_meta = sorted(
        route for route in DYNAMIC_ROUTES
        if route in routes and not _route_has_title_contract(route, meta_routes)
    )
    if dynamic_missing_meta:
        errors.append(f"dynamic routes missing parent title contract: {', '.join(dynamic_missing_meta)}")
    concrete_missing_meta = sorted(
        route for route in production_routes
        if route not in LEGACY_ROUTES
        and route not in DYNAMIC_ROUTES
        and not _route_has_title_contract(route, meta_routes)
    )
    if concrete_missing_meta:
        errors.append(f"production routes missing route title contract: {', '.join(concrete_missing_meta)}")
    if re.search(r'<Route\s+path="/?src/', APP):
        errors.append("source path exposed as a business route")
    if "key={transitionKey}" in LAYOUT or re.search(r'<Outlet[^>]+key=', LAYOUT):
        errors.append("route outlet is force-remounted")
    menu_routes = re.findall(r"\bto:\s*'([^']+)'", NAVIGATION)
    duplicate_menu_routes = sorted({route for route in menu_routes if menu_routes.count(route) > 1})
    if duplicate_menu_routes:
        errors.append(f"duplicate menu route owners: {', '.join(duplicate_menu_routes)}")
    if "选择订单查看详情" in NAVIGATION:
        errors.append("order detail must be reached from the order list, not the menu")
    if re.search(r"label:\s*'Listing管理'[^\n]+to:\s*'/publish'", NAVIGATION):
        errors.append("listing management must not alias the batch-publish route")
    nav_array = re.search(r"export const navItems: NavItem\[] = \[(.*?)]\n\nexport const legacyRouteMap", NAVIGATION, re.S)
    if nav_array and "children:" in nav_array.group(1):
        errors.append("left navigation must contain first-level items only; move secondary functions into page content")
    for old_label in ("label: '风险管控'", "label: '业务链路'", "'/risk-control': '风险管控'", "'/business-flow': '业务链路'"):
        if old_label in NAVIGATION or old_label in META:
            errors.append(f"outdated top-level label remains: {old_label}")
    if "FlyoutMenu" in SIDEBAR or "createPortal" in SIDEBAR:
        errors.append("sidebar must not render secondary flyout menus")
    if "ModuleSubnav" not in LAYOUT:
        errors.append("module secondary functions must be rendered inside page content via ModuleSubnav")
    required_module_routes = {
        "/scout/sources", "/scout", "/smart/radar", "/smart/cross", "/profit",
        "/products", "/inventory-alerts",
        "/content", "/pricing", "/publish", "/publish/templates",
        "/orders", "/orders/after-sales", "/shipments",
        "/operations", "/growth", "/ai-suggestions",
        "/finance", "/monitor",
    }
    missing_module_routes = sorted(route for route in required_module_routes if f"'{route}'" not in MODULE_SUBNAV)
    if missing_module_routes:
        errors.append(f"missing module subnav routes: {', '.join(missing_module_routes)}")
    for route in ("/reports", "/ai-suggestions", "/shipments", "/smart/radar", "/smart/cross", "/profit", "/publish", "/monitor"):
        if f"'{route}'" not in META:
            errors.append(f"missing route title: {route}")
    return errors


def _route_has_title_contract(route: str, meta_routes: set[str]) -> bool:
    normalized = "/" + route.lstrip("/")
    if normalized in meta_routes:
        return True
    if "/:" in normalized:
        parent = normalized.split("/:")[0]
        return parent in meta_routes
    segments = normalized.strip("/").split("/")
    while len(segments) > 1:
        segments.pop()
        if "/" + "/".join(segments) in meta_routes:
            return True
    return False


if __name__ == "__main__":
    failures = validate()
    if failures:
        raise SystemExit("\n".join(failures))
    route_count = len(set(re.findall(r'<Route\s+path="([^"]+)"', APP)) - AUTH_ROUTES)
    print(f"Validated {route_count} production frontend routes; {len(REQUIRED)} critical routes pinned")

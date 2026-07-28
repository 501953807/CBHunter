"""Static API style guards for audited route files."""

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_audited_routes_use_keyword_http_exception_arguments():
    violations = []
    pattern = re.compile(r"HTTPException\(\s*\d")
    for path in sorted((ROOT / "backend/app/api/v1").glob("*.py")):
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if pattern.search(line):
                violations.append(f"{path.relative_to(ROOT)}:{lineno}:{line.strip()}")

    assert violations == []


def test_settings_warehouse_routes_are_split_from_large_settings_router():
    settings_path = ROOT / "backend/app/api/v1/settings.py"
    warehouse_path = ROOT / "backend/app/api/v1/settings_warehouses.py"
    system_config_path = ROOT / "backend/app/api/v1/settings_system_config.py"
    field_dictionary_path = ROOT / "backend/app/api/v1/settings_field_dictionary.py"
    router_path = ROOT / "backend/app/api/router.py"
    settings_source = settings_path.read_text(encoding="utf-8")
    router_source = router_path.read_text(encoding="utf-8")

    assert warehouse_path.exists()
    assert system_config_path.exists()
    assert field_dictionary_path.exists()
    assert len(settings_source.splitlines()) < 800
    assert '@router.get("/warehouses"' not in settings_source
    assert '@router.get("/system-config"' not in settings_source
    assert '@router.get("/field-dictionary"' not in settings_source
    assert "settings_warehouses_router" in router_source
    assert "settings_system_config_router" in router_source
    assert "settings_field_dictionary_router" in router_source
    assert "api_router.include_router(settings_warehouses_router)" in router_source
    assert "api_router.include_router(settings_system_config_router)" in router_source
    assert "api_router.include_router(settings_field_dictionary_router)" in router_source


def test_discovery_trend_routes_are_split_from_large_discovery_router():
    discovery_path = ROOT / "backend/app/api/v1/discovery.py"
    trend_path = ROOT / "backend/app/api/v1/discovery_trends.py"
    router_path = ROOT / "backend/app/api/router.py"
    discovery_source = discovery_path.read_text(encoding="utf-8")
    router_source = router_path.read_text(encoding="utf-8")

    assert trend_path.exists()
    assert len(discovery_source.splitlines()) < 1000
    assert '@router.get("/trends"' not in discovery_source
    assert "discovery_trends_router" in router_source
    assert "api_router.include_router(discovery_trends_router)" in router_source


def test_fastapi_uses_single_global_exception_registration():
    main_source = (ROOT / "backend/app/main.py").read_text(encoding="utf-8")

    assert "register_exception_handlers(app)" in main_source
    assert "@app.exception_handler(Exception)" not in main_source


def test_manual_order_import_uses_batch_transaction_service():
    order_service = (ROOT / "backend/app/services/order_service.py").read_text(encoding="utf-8")
    manual_service_path = ROOT / "backend/app/services/order_manual_service.py"

    assert manual_service_path.exists()
    assert "from app.services.order_manual_service import create_manual_order, import_manual_orders" in order_service
    manual_source = manual_service_path.read_text(encoding="utf-8")
    import_body = manual_source.split("async def import_manual_orders", 1)[1]
    assert "await create_manual_order" not in import_body
    assert import_body.count("await db.commit()") == 1
    assert "existing_manual_ids" in import_body
    assert "accessible_accounts" in import_body

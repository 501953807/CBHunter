from pathlib import Path
import runpy


def test_frontend_route_contract_is_complete():
    root = Path(__file__).resolve().parents[2]
    module = runpy.run_path(str(root / "scripts/validate_frontend_routes.py"))
    assert module["validate"]() == []

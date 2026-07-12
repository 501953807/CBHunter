"""Test-report artifacts must remain readable and validated."""

import importlib.util
from pathlib import Path


def test_all_test_report_files_are_readable():
    script_path = Path(__file__).resolve().parents[2] / "scripts" / "validate_test_reports.py"
    spec = importlib.util.spec_from_file_location("validate_test_reports", script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)

    reports = module.validate_reports()
    assert reports

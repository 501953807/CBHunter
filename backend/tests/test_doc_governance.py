"""Documentation governance regression tests."""

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _load_validator():
    path = ROOT / "scripts" / "validate_doc_governance.py"
    spec = importlib.util.spec_from_file_location("validate_doc_governance", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_test_report_validator():
    path = ROOT / "scripts" / "validate_test_reports.py"
    spec = importlib.util.spec_from_file_location("validate_test_reports", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_api_evidence_validator():
    path = ROOT / "scripts" / "validate_api_evidence_contract.py"
    spec = importlib.util.spec_from_file_location("validate_api_evidence_contract", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_core_docs_have_governance_and_ordered_recent_changelog():
    validator = _load_validator()

    result = validator.validate_docs(ROOT)

    assert result["checked"] == [
        "docs/实施任务进度.md",
        "docs/模块功能说明.md",
        "docs/系统建设方案4.0-实施任务总表.md",
    ]
    assert result["module_recent_dates"] == ["2026-06-30", "2026-07-01", "2026-07-02"]
    assert result["obsolete_docs_absent"] == [
        "docs/测试报告整改统一规划-20260620.md",
        "docs/系统业务架构与菜单整改-20260621.md",
        "docs/系统建设方案4.0.html",
    ]


def test_test_reports_directory_contains_only_report_files():
    validator = _load_test_report_validator()

    reports = validator.validate_reports()
    invalid_files = [
        path.name
        for path in (ROOT / "docs" / "test-reports").iterdir()
        if path.is_file() and path.suffix not in {".md", ".xml"}
    ]

    assert len(reports) == 3
    assert invalid_files == []


def test_api_required_state_responses_keep_evidence_contract():
    validator = _load_api_evidence_validator()

    result = validator.validate_api_evidence_contract(ROOT)

    assert result["violations"] == []

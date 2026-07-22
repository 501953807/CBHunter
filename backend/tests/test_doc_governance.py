"""Documentation governance regression tests."""

import importlib.util
from pathlib import Path
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[2]


def _doc_path(*parts: str) -> str:
    return "docs/" + "".join(parts)


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


def _read_local_agents_or_skip() -> str:
    path = ROOT / "AGENTS.md"
    if not path.exists():
        pytest.skip("AGENTS.md is local-only and absent from the code repository")
    return path.read_text(encoding="utf-8")


def test_core_docs_have_governance_and_ordered_recent_changelog():
    validator = _load_validator()

    result = validator.validate_docs(ROOT)
    if result.get("skipped"):
        pytest.skip("docs are local-only and absent from the code repository")

    assert result["checked"] == [
        "docs/00_CBHunter_V5.0系统建设方案.md",
        "docs/01_CBHunter_V5.0全局业务数据流与模块关联总览.md",
        "docs/02_CBHunter_V5.0模块功能说明.md",
        "docs/03_CBHunter_V5.0实施任务总表.md",
        "docs/迭代改造清单_V5.0/04_CBHunter_V5.0分阶段迭代开发排期与实施进度.md",
    ]
    assert result["module_recent_dates"] == ["2026-06-30", "2026-07-01", "2026-07-02"]
    assert result["obsolete_docs_absent"] == [
        _doc_path("测试报告", "整改统一规划-20260620.md"),
        _doc_path("系统业务架构", "与菜单整改-20260621.md"),
        _doc_path("系统建设", "方案4.0.html"),
    ]


def test_test_reports_directory_contains_only_report_files():
    validator = _load_test_report_validator()

    reports = validator.validate_reports()
    report_dir = ROOT / "docs" / "测试报告"
    if not report_dir.exists():
        assert reports == []
        return
    invalid_files = [
        path.name
        for path in report_dir.rglob("*")
        if path.is_file() and not path.name.startswith(".") and path.suffix not in {".md", ".xml"}
    ]

    report_names = {path.name for path in reports}
    assert "00-测试总览.md" in report_names
    assert "2026-07-16-project-audit-report.md" in report_names
    assert invalid_files == []


def test_test_report_validator_uses_current_chinese_report_directory():
    validator = _load_test_report_validator()

    assert validator.REPORT_DIR == ROOT / "docs" / "测试报告"


def test_project_docs_are_excluded_from_code_repository():
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    ignored = {line.strip() for line in gitignore if line.strip() and not line.startswith("#")}

    assert {
        "docs/",
        "README.md",
        "README",
        "README*.md",
        "AGENTS.md",
        "CLAUDE.md",
        "design-qa.md",
        ".env.example",
        ".mcp.json",
        "*说明*.md",
        "*方案*.md",
        "*规划*.md",
        "*报告*.md",
        "*审计*.md",
        "*测试*.md",
    }.issubset(ignored)


def test_project_docs_are_not_tracked_by_git():
    tracked = subprocess.run(
        [
            "git",
            "ls-files",
            "docs",
            "README",
            "README.md",
            "README*.md",
            "AGENTS.md",
            "CLAUDE.md",
            "design-qa.md",
            ".env.example",
            ".mcp.json",
        ],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    assert tracked.stdout.strip() == ""


def test_git_tracked_files_do_not_include_disclosure_documents():
    tracked = subprocess.run(
        ["git", "ls-files"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    disclosure_keywords = ("说明", "方案", "规划", "报告", "审计", "测试")
    blocked_paths = []
    for raw_path in tracked.stdout.splitlines():
        path = raw_path.strip()
        name = Path(path).name
        if path.startswith("docs/"):
            blocked_paths.append(path)
        elif name == "README" or name.startswith("README"):
            blocked_paths.append(path)
        elif name in {"AGENTS.md", "CLAUDE.md", "design-qa.md", ".env.example", ".mcp.json"}:
            blocked_paths.append(path)
        elif name.endswith(".md") and any(keyword in name for keyword in disclosure_keywords):
            blocked_paths.append(path)

    assert blocked_paths == []


def test_code_repository_has_minimal_ci_and_container_manifests():
    workflow = ROOT / ".github/workflows/ci.yml"
    compose = ROOT / "docker-compose.yml"
    backend_dockerfile = ROOT / "backend/Dockerfile"
    frontend_dockerfile = ROOT / "frontend/Dockerfile"

    assert workflow.exists(), "GitHub Actions workflow is required for code-only CI"
    assert compose.exists(), "docker-compose.yml is required for local startup validation"
    assert backend_dockerfile.exists(), "backend/Dockerfile is required for container build"
    assert frontend_dockerfile.exists(), "frontend/Dockerfile is required for container build"

    workflow_source = workflow.read_text(encoding="utf-8")
    compose_source = compose.read_text(encoding="utf-8")
    assert "pytest" in workflow_source
    assert "npm run build" in workflow_source
    assert "validate_doc_governance.py" in workflow_source
    assert "docs/" not in workflow_source
    assert ".env.example" not in workflow_source
    assert "backend" in compose_source
    assert "frontend" in compose_source
    assert ".env.example" not in compose_source


def test_github_repository_is_code_only_boundary():
    agents = _read_local_agents_or_skip()

    assert "GitHub is used for source code control only" in agents
    assert "Never stage, commit, push, or publish project documentation" in agents
    assert "project information leakage" in agents


def test_code_file_split_threshold_stays_at_800_lines():
    agents = _read_local_agents_or_skip()

    assert "800 lines" in agents
    assert "300 lines" in agents
    assert "Do not split files merely because they exceed 300 lines" in agents


def test_backend_test_layers_are_not_empty_and_have_shared_helpers():
    unit_tests = list((ROOT / "backend/tests/unit").glob("test_*.py"))
    integration_tests = list((ROOT / "backend/tests/integration").glob("test_*.py"))
    support_db = ROOT / "backend/tests/support/db.py"

    assert unit_tests, "backend/tests/unit must contain focused unit tests"
    assert integration_tests, "backend/tests/integration must contain integration contract tests"
    assert support_db.exists(), "backend/tests/support/db.py must provide shared test fixtures"

    support_source = support_db.read_text(encoding="utf-8")
    for marker in ("create_sqlite_sessionmaker", "seed_order_statuses"):
        assert marker in support_source


def test_api_required_state_responses_keep_evidence_contract():
    validator = _load_api_evidence_validator()

    result = validator.validate_api_evidence_contract(ROOT)

    assert result["violations"] == []

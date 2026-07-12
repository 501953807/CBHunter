"""Fail fast when generated test-report artifacts are not readable."""

from pathlib import Path
from xml.etree import ElementTree


REPORT_DIR = Path(__file__).resolve().parents[1] / "docs" / "test-reports"


def validate_reports() -> list[Path]:
    invalid_files = [
        path for path in sorted(REPORT_DIR.iterdir())
        if path.is_file() and path.suffix not in {".md", ".xml"}
    ]
    if invalid_files:
        names = ", ".join(path.name for path in invalid_files)
        raise RuntimeError(f"Non-report files found in {REPORT_DIR}: {names}")
    reports = sorted(REPORT_DIR.glob("*.xml")) + sorted(REPORT_DIR.glob("*.md"))
    if not reports:
        raise RuntimeError(f"No test reports found in {REPORT_DIR}")
    for report in reports:
        if report.suffix == ".xml":
            ElementTree.parse(report)
        elif report.suffix == ".md":
            _validate_markdown_report(report)
    return reports


def _validate_markdown_report(report: Path) -> None:
    content = report.read_text(encoding="utf-8")
    required_markers = ("# ", "|", "P1", "P2")
    missing = [marker for marker in required_markers if marker not in content]
    if missing:
        raise RuntimeError(f"{report} is missing required report markers: {', '.join(missing)}")
    if not any(token in content for token in ("问题", "缺口", "建议")):
        raise RuntimeError(f"{report} does not contain actionable findings")


if __name__ == "__main__":
    validated = validate_reports()
    print(f"Validated {len(validated)} test reports")

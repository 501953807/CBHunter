"""Static API style guards for audited route files."""

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_audited_routes_use_keyword_http_exception_arguments():
    audited_files = [
        ROOT / "backend/app/api/v1/monitor.py",
        ROOT / "backend/app/api/v1/scout.py",
    ]

    violations = []
    pattern = re.compile(r"HTTPException\(\s*\d")
    for path in audited_files:
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if pattern.search(line):
                violations.append(f"{path.relative_to(ROOT)}:{lineno}:{line.strip()}")

    assert violations == []

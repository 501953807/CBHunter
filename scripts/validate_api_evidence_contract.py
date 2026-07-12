"""Validate API required-state responses keep the evidence contract.

The system must not return bare ``data_required`` or ``configuration_required``
payloads from route handlers. Required-state responses need to be wrapped by the
shared evidence response path and carry actionable gaps plus an evidence window.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any


API_DIR = Path("backend/app/api/v1")
SERVICE_DIR = Path("backend/app/services")
REQUIRED_HELPERS = {"data_required", "configuration_required"}
REQUIRED_STATUSES = {"data_required", "configuration_required"}
REQUIRED_EVIDENCE_FIELDS = {"data_gaps", "evidence_window", "confidence_reason"}
INVALID_HELPER_KEYWORDS = {"data", "gaps"}


def validate_api_evidence_contract(root: Path | None = None) -> dict[str, Any]:
    base = root or Path(__file__).resolve().parents[1]
    files = sorted((base / API_DIR).glob("*.py")) + sorted((base / SERVICE_DIR).glob("*.py"))
    violations: list[str] = []

    for file_path in files:
        tree = ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))
        rel = file_path.relative_to(base)
        in_api = API_DIR in rel.parents
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                helper_name = _call_name(node)
                if helper_name in REQUIRED_HELPERS:
                    invalid = sorted(
                        keyword.arg
                        for keyword in node.keywords
                        if keyword.arg in INVALID_HELPER_KEYWORDS
                    )
                    if invalid:
                        violations.append(
                            f"{rel}:{node.lineno} {helper_name} uses invalid keyword(s): {', '.join(invalid)}"
                        )
                if _call_name(node) == "ApiResponse":
                    _validate_api_response_call(rel, node, violations)

            if in_api and isinstance(node, ast.Return):
                returned = node.value
                if isinstance(returned, ast.Call) and _call_name(returned) in REQUIRED_HELPERS:
                    violations.append(
                        f"{rel}:{node.lineno} route returns {_call_name(returned)} directly; wrap with evidence_response"
                    )
                if isinstance(returned, ast.Call) and _call_name(returned) == "ApiResponse":
                    _validate_nested_required_helper(rel, returned, violations)

    return {
        "checked_files": [str(path.relative_to(base)) for path in files],
        "violations": violations,
    }


def _validate_api_response_call(rel: Path, node: ast.Call, violations: list[str]) -> None:
    status = _constant_keyword(node, "status")
    if status not in REQUIRED_STATUSES:
        return
    field_names = {keyword.arg for keyword in node.keywords if keyword.arg}
    missing = sorted(REQUIRED_EVIDENCE_FIELDS - field_names)
    if missing:
        violations.append(
            f"{rel}:{node.lineno} ApiResponse status={status!r} missing evidence field(s): {', '.join(missing)}"
        )


def _validate_nested_required_helper(rel: Path, node: ast.Call, violations: list[str]) -> None:
    for child in ast.walk(node):
        if child is node:
            continue
        if isinstance(child, ast.Call) and _call_name(child) in REQUIRED_HELPERS:
            violations.append(
                f"{rel}:{child.lineno} ApiResponse nests {_call_name(child)} directly; use evidence_response"
            )


def _call_name(node: ast.Call) -> str | None:
    func = node.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def _constant_keyword(node: ast.Call, name: str) -> str | None:
    for keyword in node.keywords:
        if keyword.arg != name:
            continue
        value = keyword.value
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            return value.value
    return None


if __name__ == "__main__":
    result = validate_api_evidence_contract()
    if result["violations"]:
        joined = "\n".join(result["violations"])
        raise SystemExit(f"API evidence contract violations:\n{joined}")
    print(f"Validated API evidence contract: {len(result['checked_files'])} files")

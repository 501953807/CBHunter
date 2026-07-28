#!/usr/bin/env python3
"""Validate module navigation and settings information architecture."""

from frontend_architecture_checks.runner import validate


if __name__ == "__main__":
    validation_errors = validate()
    if validation_errors:
        for error in validation_errors:
            print(f"[architecture] {error}")
        raise SystemExit(1)
    print("Validated frontend information architecture")

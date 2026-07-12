"""Regression tests for Pydantic schema compatibility."""

import ast
from pathlib import Path


SCHEMA_DIR = Path(__file__).resolve().parents[1] / "app" / "schemas"
APP_DIR = SCHEMA_DIR.parent


def test_schemas_do_not_use_deprecated_class_config():
    deprecated_configs = []

    for path in APP_DIR.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == "Config":
                deprecated_configs.append(f"{path.name}:{node.lineno}")

    assert deprecated_configs == []


def test_schemas_do_not_use_mutable_collection_defaults():
    mutable_defaults = []

    for path in APP_DIR.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for model in (node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)):
            is_pydantic_model = any(
                isinstance(base, ast.Name) and base.id == "BaseModel"
                for base in model.bases
            )
            if not is_pydantic_model:
                continue
            for node in model.body:
                if isinstance(node, ast.AnnAssign) and isinstance(node.value, (ast.List, ast.Dict, ast.Set)):
                    mutable_defaults.append(f"{path.name}:{node.lineno}")

    assert mutable_defaults == []

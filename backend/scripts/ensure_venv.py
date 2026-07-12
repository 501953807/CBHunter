#!/usr/bin/env python3
"""Ensure backend/venv is a usable Python 3.13 virtual environment."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
VENV = BACKEND / "venv"
REQ = BACKEND / "requirements.txt"
MIN_VERSION = (3, 13)
REQUIRED_IMPORTS = [
    "fastapi",
    "uvicorn",
    "sqlalchemy",
    "aiosqlite",
    "jose",
    "bcrypt",
    "multipart",
    "httpx",
    "apscheduler",
    "cryptography",
    "PIL",
    "dotenv",
    "pandas",
    "openpyxl",
]


def run(cmd: list[str], env: Optional[dict[str, str]] = None) -> None:
    subprocess.run(cmd, check=True, env=env)


def venv_python() -> Path:
    return VENV / "bin" / "python"


def is_usable_venv() -> bool:
    python = venv_python()
    if not python.exists():
        return False
    try:
        result = subprocess.run(
            [str(python), "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
            check=True,
            text=True,
            capture_output=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return False
    major, minor = (int(part) for part in result.stdout.strip().split(".")[:2])
    return (major, minor) >= MIN_VERSION


def backup_broken_venv() -> None:
    if not VENV.exists():
        return
    backup = BACKEND / "venv.broken"
    if backup.exists():
        shutil.rmtree(backup)
    VENV.rename(backup)
    print(f"已备份旧虚拟环境: {backup}")


def dependencies_ready() -> bool:
    python = venv_python()
    if not python.exists():
        return False
    code = "\n".join([f"import {name}" for name in REQUIRED_IMPORTS])
    try:
        subprocess.run([str(python), "-c", code], check=True, capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError):
        return False
    return True


def ensure_python_version() -> None:
    if sys.version_info < MIN_VERSION:
        raise SystemExit(
            f"需要 Python {MIN_VERSION[0]}.{MIN_VERSION[1]}+，当前为 "
            f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        )


def main() -> None:
    ensure_python_version()
    if not is_usable_venv():
        backup_broken_venv()
        run([sys.executable, "-m", "venv", str(VENV)])
    if dependencies_ready():
        print(f"后端虚拟环境就绪: {venv_python()}")
        return
    env = os.environ.copy()
    env.setdefault("PIP_CACHE_DIR", str(ROOT / ".cache" / "pip"))
    run([
        str(venv_python()),
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "-r",
        str(REQ),
    ], env=env)
    print(f"后端虚拟环境就绪: {venv_python()}")


if __name__ == "__main__":
    main()
